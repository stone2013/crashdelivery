#!/usr/bin/env python3
"""CPU/DOM regression using the real game JS and asset bytes with a NO-OP WebGL adapter.
This is NOT a browser GPU / physical mobile / public multiplayer acceptance test.
Requires Python Playwright + a Chromium executable. No app file is modified.
"""
import sys,json,time,gzip,argparse,hashlib,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--chromium',default=shutil.which('chromium') or shutil.which('google-chrome'))
parser.add_argument('--output',type=Path,default=ROOT/'tests/v012/results')
parser.add_argument('--capture',action='store_true',help='Save native geometry draw streams for an optional offline renderer, not GPU screenshots.')
args=parser.parse_args()
sys.path.insert(0,str(ROOT))
from browser_helpers import offline_html
html=offline_html(ROOT/'index.html')
html=html.replace('<head>','<head><script>'+Path(__file__).with_name('fake-gl.js').read_text()+'</script>',1)
OUT=args.output;OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=b.new_page(viewport={'width':1280,'height':720});errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('ERROR',e,flush=True)));page.on('console',lambda m:print('ERR',m.text[:500],flush=True) if m.type=='error' else None);page.set_content(html,timeout=120000);page.wait_for_function('window.__city012Ready',timeout=180000,polling=250);print('READY',flush=True)
 result=page.evaluate('({info:__deliveryTest.city012.info(),audit:__deliveryTest.city012.audit(),connected:__deliveryTest.city012.connected(),models:__deliveryTest.city012.models()})');print('AUDIT',json.dumps(result['audit'])[:1000],flush=True)
 result['rethrows']=[]
 for wrong,order in [(101,102),(104,105),(113,114),(114,113),(117,118),(118,117)]:
  r=page.evaluate('([w,o])=>__deliveryTest.city012.regressionRethrow(w,o)',[wrong,order]);print('RETHROW',wrong,r,flush=True);result['rethrows'].append({'wrong':wrong,**r})
 page.evaluate('__deliveryTest.suburban011.reset()');result['deliveries']=[]
 for num in range(101,119):
  r=page.evaluate('(n)=>__deliveryTest.city012.delivery(n)',num);print('DELIVERY',r,flush=True);result['deliveries'].append(r)
 page.evaluate('__deliveryTest.suburban011.reset();__deliveryTest.city012.disableTraffic()');result['roads']=[]
 for id in ['H1','H2','H3','R1','R2','R3','R4','R5','R6','R7']:
  for rev in [False,True]:
   r=page.evaluate('([id,rev])=>__deliveryTest.city012.followRoad(id,rev)',[id,rev]);print('ROAD',r,flush=True);result['roads'].append(r)
 result['routes']=[]
 for a,z in [([0,.12,56],[-196,.08,-196]),([-224,.12,112],[0,.08,-224]),([360,8.12,-168],[-224,.08,112]),([-168,16.12,0],[28,.08,-224])]:
  r=page.evaluate('([a,z])=>__deliveryTest.city012.nav(a,z)',[a,z]);print('ROUTE',r['length'],r['highways'],flush=True);result['routes'].append({'from':a,'to':z,**r})
 # CPU/DOM layout emulation, NOT a physical iPhone or GPU performance benchmark.
 result['layouts']=[]
 for w,h in [(1280,720),(390,844),(844,390)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(300);r=page.evaluate('({w:innerWidth,h:innerHeight,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,buttons:[...document.querySelectorAll("#startBtn,#throwBtn,#driveBtn,#mapOpenBtn")].map(e=>({id:e.id,rect:e.getBoundingClientRect().toJSON()}))})');result['layouts'].append(r)
 page.set_viewport_size({'width':1280,'height':720});page.evaluate('__deliveryTest.suburban011.reset();__deliveryTest.freeze(true)')
 result['raw']=page.evaluate('__deliveryTest.city012.raw()');
 (OUT/'regression.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 result['extras']=page.evaluate('__deliveryTest.city012.extras()')
 result['html_sha256']=hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest()
 result['test_mode']='CPU/DOM + no-op WebGL adapter, NOT browser GPU acceptance'
 # Real in-game vertex buffers & model/view transforms for an offline software GL preview.
 if args.capture:
  for name,eye,at in [('downtown',[25,49,16],[-20,8,-95]),('ringroad',[-246,24,252],[-272,8,187]),('residential',[-174,27,218],[-186,2,182]),('skyline',[130,78,-74],[-22,14,-144])]:
   page.evaluate('window.__captureDraws=true;window.__fakeGLDraws=[]')
   page.evaluate('([a,b])=>__deliveryTest.city012.camera(a,b)',[eye,at]);data=page.evaluate('(()=>{const ds=__fakeGLDraws,ids=new Set(ds.map(d=>d.buffer));return {draws:ds,buffers:__fakeGLBuffers.filter(b=>ids.has(b.id)).map(b=>{const bytes=new Uint8Array(new Float32Array(b.data).buffer);let text=String();for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return {id:b.id,b64:btoa(text)};}),eye:null};})()');gzip.open(OUT/(name+'-draws.json.gz'),'wt').write(json.dumps(data));print('CAPTURE',name,len(data['draws']),flush=True);page.evaluate('window.__captureDraws=false')
 result['errors']=errors;(OUT/'regression.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
 checks={
  'loaded_54_native_models':result['info']['assets']==54 and result['info']['ready'],
  'no_runtime_errors':not errors,
  'building_footprints_nonoverlap':not result['audit']['overlaps'],
  'no_building_on_road':not result['audit']['roadConflicts'],
  'all_18_addresses_have_gates':len(result['audit']['gates'])==18 and all(g['count'] for g in result['audit']['gates']),
  'all_native_addresses_placed':not result['audit']['unplaced'],
  'every_sampled_deck_has_surface':not result['audit']['surfaceMisses'],
  'connected_navigation':result['connected']['reached']==result['connected']['total'],
  'recovered_rethrows_6':len(result['rethrows'])==6 and all(r['rejected'] and r['recovered'] and r['cleared'] and r['released'] and r['blocked'] for r in result['rethrows']),
  'deliveries_18':len(result['deliveries'])==18 and all(r['delivered'] for r in result['deliveries']),
  'highway_lane_sweeps_20':len(result['roads'])==20 and all(not r['contacts'] and r['maxYError']<.1 for r in result['roads']),
  'desktop_mobile_no_horizontal_overflow':all(r['doc']<=r['w'] and r['body']<=r['w'] for r in result['layouts']),
  'street_throttle':result['extras']['street']['speed']>5,
  'elevated_throttle':result['extras']['elevated']['speed']>5 and abs(result['extras']['elevated']['p'][1]-8.12)<.1,
  'brick_throttle':result['extras']['brick']['speed']>5,
  'no_bridge_ground_ghost_collision':result['extras']['ghost']['hp']==100,
  'props_impulse_and_sleep':result['extras']['prop']['awake'] and result['extras']['propAsleep'],
  'vehicle_mass_response':result['extras']['mass']['small']['vanSpeed']>result['extras']['mass']['heavy']['vanSpeed'] and result['extras']['mass']['small']['npcSpeed']>result['extras']['mass']['heavy']['npcSpeed'],
  'bounded_native_fragments':all(0<x['fragments']<=3 for x in result['extras']['mass'].values()),
  'host_snapshot_prop_roundtrip':result['extras']['sync']['match'],
  'npc_models_in_snapshot':result['extras']['sync']['trafficModels']==32 and result['extras']['sync']['highwayModels']==17,
  'deck_underside_blocks_throw':result['extras']['underside']['blocked']
 }
 result['checks']=checks
 (OUT/'regression.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print('CHECK GROUPS:',sum(checks.values()),'/',len(checks),flush=True)
 if not all(checks.values()):raise SystemExit('FAILED: '+', '.join(k for k,v in checks.items() if not v))
 print('DONE: CPU/DOM checks passed. Actual WebGL, physical-device performance and public multiplayer remain unverified.',flush=True)
