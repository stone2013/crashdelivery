"""A genuine local RTC negotiation attempt; no bridge used by this probe."""
from test_utils import *
from playwright.sync_api import sync_playwright
import json,time
result={'kind':'Native RTCPeerConnection / RTCDataChannel negotiation, two Chromium contexts','connected':False}
with sync_playwright() as p:
 b=launch(p);hc,h,he=load(b);gc,g,ge=load(b)
 try:
  for pg in (h,g):pg.evaluate('''()=>{window.nativePC=new RTCPeerConnection({iceServers:[]});window.nativeICE=[];nativePC.onicecandidate=e=>{if(e.candidate)nativeICE.push(e.candidate.toJSON());};window.nativeReceived=[];}''')
  h.evaluate('''()=>{window.nativeDC=nativePC.createDataChannel('v07-check',{ordered:true});nativeDC.onmessage=e=>nativeReceived.push(e.data);}''')
  g.evaluate('''()=>{nativePC.ondatachannel=e=>{window.nativeDC=e.channel;nativeDC.onmessage=e=>{nativeReceived.push(e.data);nativeDC.send('guest-ack');};};}''')
  offer=h.evaluate('''async()=>{const o=await nativePC.createOffer();await nativePC.setLocalDescription(o);return nativePC.localDescription.toJSON();}''')
  g.evaluate('o=>nativePC.setRemoteDescription(o)',offer)
  answer=g.evaluate('''async()=>{const a=await nativePC.createAnswer();await nativePC.setLocalDescription(a);return nativePC.localDescription.toJSON();}''')
  h.evaluate('a=>nativePC.setRemoteDescription(a)',answer)
  count=[0,0];start=time.monotonic()
  while time.monotonic()-start<10:
   for i,(src,dst) in enumerate([(h,g),(g,h)]):
    ice=src.evaluate('nativeICE.splice(0)');count[i]+=len(ice)
    if ice:dst.evaluate('async xs=>{for(const x of xs)await nativePC.addIceCandidate(x);}',ice)
   st=h.evaluate('nativeDC.readyState')
   if st=='open':
    h.evaluate("nativeDC.send('host-native-ping')");h.wait_for_timeout(100)
    result['connected']=h.evaluate("nativeReceived.includes('guest-ack')") and g.evaluate("nativeReceived.includes('host-native-ping')");break
   h.wait_for_timeout(100)
  result.update({'host':h.evaluate('({connection:nativePC.connectionState,ice:nativePC.iceConnectionState,gathering:nativePC.iceGatheringState,channel:nativeDC.readyState})'),'guest':g.evaluate('({connection:nativePC.connectionState,ice:nativePC.iceConnectionState,gathering:nativePC.iceGatheringState,channel:window.nativeDC?.readyState||null})'),'ice_candidates':count,'js_errors':he+ge})
 except Exception as e:result['error']=str(e)
 for pg in (h,g):
  try:pg.evaluate('window.nativePC?.close()')
  except:pass
 b.close()
(ROOT/'tests/native_rtc_probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
