import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_utils import launch,load

with sync_playwright() as p:
 b=launch(p);ctx,pg,errors=load(b,mobile=False,size=(1280,800))
 pg.evaluate('''()=>{
  const urls=[
   'turn:turn.cloudflare.com:3478?transport=udp',
   'turn:turn.cloudflare.com:3478?transport=tcp',
   'turns:turn.cloudflare.com:5349?transport=tcp',
   'turn:turn.cloudflare.com:443?transport=udp',
   'turn:turn.cloudflare.com:80?transport=tcp',
   'turns:turn.cloudflare.com:443?transport=tcp'
  ];
  window.CRASH_TURN_CREDENTIALS_URL='https://test.invalid/turn-credentials';
  const storage={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=String(v),removeItem:k=>delete storage[k]}});
  const fakeUsername='mock-'+Math.random().toString(36).slice(2),fakeCredential='mock-'+Math.random().toString(36).slice(2);
  window.fetch=async()=>({ok:true,status:200,json:async()=>({iceServers:[
   {urls:'stun:stun.cloudflare.com:3478'},
   {urls,username:fakeUsername,credential:fakeCredential}
  ]})});
  window.turnHarness={configs:[],storage,initialPolicy:document.querySelector('#netPolicy').value};
  window.RTCPeerConnection=class extends EventTarget{
   constructor(config){super();this.config=config;this.iceGatheringState='gathering';this.closed=false;this.record={config,channel:false,offer:false,local:false};window.turnHarness.configs.push(this.record);}
   createDataChannel(){this.record.channel=true;return {};}
   async createOffer(){this.record.offer=true;return {type:'offer',sdp:'v=0\\r\\n'};}
   async setLocalDescription(){this.record.local=true;const url=this.config.iceServers[0].urls;if(url.includes('443?transport=udp'))return;const delay=url.includes('3478?transport=tcp')?35:url.includes('5349')?85:20;setTimeout(()=>{
    if(url.includes('3478?transport=tcp')||url.includes('5349')){const e=new Event('icecandidate');e.candidate={candidate:'candidate:1 1 UDP 2122260223 192.0.2.10 50000 typ relay',toJSON(){return {candidate:this.candidate}}};this.dispatchEvent(e);}
    else {const err=new Event('candidateerror');Object.defineProperty(err,'errorCode',{value:701});this.dispatchEvent(err);}
    this.iceGatheringState='complete';this.dispatchEvent(new Event('icegatheringstatechange'));this.dispatchEvent(new Event('icecandidate'));
   },delay);}
   close(){this.closed=true;}
  };
 }''')
 pg.locator('#networkBtn').click();pg.locator('#netPolicy').select_option('direct');pg.locator('#testIceBtn').click();pg.wait_for_function("document.querySelector('#iceDiag').innerText.includes('六路 TURN 实测')",timeout=15000)
 diag=pg.locator('#iceDiag').inner_text()
 harness=pg.evaluate('''()=>({
   configs:window.turnHarness.configs.map(x=>({url:x.config.iceServers[0].urls,policy:x.config.iceTransportPolicy,channel:x.channel,offer:x.offer,local:x.local})),
   localStorage:JSON.stringify(window.turnHarness.storage),
   route:localStorage.getItem('crash_delivery_turn_route_v073'),
   defaultPolicy:window.turnHarness.initialPolicy,
   diagnosticPolicy:document.querySelector('#netPolicy').value
 })''')
 routes=['UDP 3478','TCP 3478','TLS 5349','UDP 443','TCP 80','TLS 443']
 passed={
  'six routes rendered':all(x in diag for x in routes),
  'six separate relay-only PeerConnections':len(harness['configs'])==6 and all(x['policy']=='relay' and x['channel'] and x['offer'] and x['local'] for x in harness['configs']),
  'each PeerConnection tests one URL':len({x['url'] for x in harness['configs']})==6 and all(isinstance(x['url'],str) for x in harness['configs']),
  'only relay candidate marks success':'TCP 3478 · 推荐' in diag and 'TLS 5349' in diag and 'UDP 3478 · 推荐' not in diag,
  'gathering deadline reports timeout':'UDP 443' in diag and '⌛ 超时' in diag,
  'timed relay is rejected as recommendation':'TCP 80 · 推荐' not in diag and 'TLS 443 · 推荐' not in diag,
  'fastest successful route saved':harness['route']=='turn:turn.cloudflare.com:3478?transport=tcp',
  'automatic P2P-first mode retained':harness['defaultPolicy']=='auto',
  'diagnostics still fetch TURN in direct mode':harness['diagnosticPolicy']=='direct' and '六路 TURN 实测' in diag,
  'short-lived credentials absent from UI and storage':'mock-' not in diag and 'mock-' not in harness['localStorage'],
  'no browser runtime errors':not errors
 }
 for name,ok in passed.items():print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 result={'checks':passed,'diag':diag,'routes':harness['configs'],'runtimeErrors':errors}
 Path(__file__).with_name('ice_ui_runtime.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 ctx.close();b.close()
 if not all(passed.values()):raise SystemExit(1)
