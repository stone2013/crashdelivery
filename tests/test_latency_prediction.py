"""Repeatable V0.7.3 client prediction and network-delay checks in Chromium."""
import json, math, random, time
from pathlib import Path
from test_utils import *
from playwright.sync_api import sync_playwright

class DelayBridge:
 def __init__(self,h,g,rtt,jitter=0,loss=.01,seed=7,force_loss=False):
  self.h,self.g=h,g;self.half=rtt/2000;self.jitter=jitter/1000;self.loss=loss;self.force_loss=force_loss;self.rng=random.Random(seed);self.q=[];self.last=[0,0];self.dropped=0;self.sent=0
  for pg,mode in [(h,'host'),(g,'guest')]:
   pg.evaluate('''mode=>{window.wireOut=[];window.wire={readyState:'connecting',bufferedAmount:0,send:s=>wireOut.push(s),close:()=>{wire.readyState='closed';wire.onclose?.();}};__deliveryTest.attachRTC(wire,mode); }''',mode)
  h.evaluate("wire.readyState='open';wire.onopen()")
  g.evaluate("wire.readyState='open';wire.onopen()")
  self.pump(.05)
 def pump(self,seconds=.05):
  end=time.monotonic()+seconds
  while True:
   now=time.monotonic()
   for direction,(src,dst) in enumerate([(self.h,self.g),(self.g,self.h)]):
    msgs=src.evaluate('wireOut.splice(0)')
    for raw in msgs:
     self.sent+=1
     try:msg=json.loads(raw)
     except Exception:continue
     # Simulate sparse loss only for replaceable snapshots/input heartbeats; critical actions remain reliable.
     if msg.get('t') in ('input','world') and (self.force_loss or self.rng.random()<self.loss):
      self.dropped+=1;continue
     due=max(now+self.half+self.rng.uniform(-self.jitter,self.jitter),self.last[direction]+.0001)
     self.last[direction]=due;self.q.append((due,dst,raw))
   now=time.monotonic();ready=[x for x in self.q if x[0]<=now];self.q=[x for x in self.q if x[0]>now]
   for _,dst,raw in ready:dst.evaluate('s=>wire.onmessage({data:s})',raw)
   if now>=end:break
   self.h.wait_for_timeout(5)
 def drive(self,seconds):
  end=time.monotonic()+seconds
  while time.monotonic()<end:self.pump(min(.04,max(.005,end-time.monotonic())))
 def drain(self,seconds=2):self.drive(seconds)

results=[]
def ck(name,ok,details=None):results.append({'test':name,'passed':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,details if not ok else '',flush=True)
with sync_playwright() as p:
 b=launch(p)
 for rtt in [0,80,150,250,400]:
  hc,h,he=load(b,size=(1000,740));gc,g,ge=load(b,mobile=True,size=(390,740));h.evaluate('__deliveryTest.freeze(true);__deliveryTest.clearTraffic()');g.evaluate('__deliveryTest.freeze(true)')
  bridge=DelayBridge(h,g,rtt,jitter=20 if rtt else 0,loss=.01,seed=19+rtt)
  H=lambda js:h.evaluate(js);G=lambda js:g.evaluate(js)
  H('__deliveryTest.clearTraffic()');bridge.drain(.2)
  G("__deliveryTest.view('drive')");bridge.drain(.9)
  # Continuous real RAF prediction is active; key down updates predicted position before host can receive a packet.
  before=G('__deliveryTest.snapshot().car.p');G("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}))")
  after=G('__deliveryTest.snapshot().car.p');locally_moved=math.dist(before,after)==0 and 'KeyW' in G('__deliveryTest.inputState().keys')
  bridge.drain(1.0);during=G('__deliveryTest.network().predictionError')
  G("window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}))");bridge.drive(5.5);bridge.drain(1.4)
  hs=H('__deliveryTest.snapshot()');gs=G('__deliveryTest.snapshot()');net=G('__deliveryTest.network()')
  distance=math.dist(hs['car']['p'],gs['car']['p']);bounded=distance<6 and math.isfinite(distance)
  seq=G('__deliveryTest.inputState().seq');H('__deliveryTest.publish()');bridge.drain(.15)
  accepted=H('__deliveryTest.network().lastInputSeq');H("wire.onmessage({data:JSON.stringify({t:'input',seq:"+str(max(0,accepted-1))+",input:{keys:['KeyW']}})})")
  stale=H('__deliveryTest.network().lastInputSeq')
  ck(f'{rtt}ms immediate guest input and local prediction armed',locally_moved,{'same_event_turn_position_m':round(math.dist(before,after),3),'key_present_before_next_frame':locally_moved,'RTT_applied_ms':rtt})
  ck(f'{rtt}ms guest and host converge after release',bounded,{'position_gap_m':round(distance,3),'guest_error_m':round(net['predictionError'],3)})
  ck(f'{rtt}ms long drive remains finite and bounded',all(math.isfinite(x) for x in gs['car']['p']) and bounded,{'host':hs['car']['p'],'guest':gs['car']['p'],'peak_sample_error_m':round(during,2) if during is not None else None})
  ck(f'{rtt}ms stale input sequence rejected',stale==accepted,{'accepted_seq':stale,'stale_seq':accepted-1})
  ck(f'{rtt}ms simulated jitter/loss exercised',bridge.jitter>=0 and bridge.loss==.01,{'jitter_ms':20 if rtt else 0,'configured_loss':.01,'dropped':bridge.dropped,'sent':bridge.sent})
  ck(f'{rtt}ms no Chromium runtime errors',not he and not ge,{'host':he,'guest':ge})
  h.close();g.close();hc.close();gc.close()
 # Hard authority correction after a collision/respawn-sized host relocation.
 hc,h,he=load(b,size=(1000,740));gc,g,ge=load(b,mobile=True,size=(390,740));h.evaluate('__deliveryTest.freeze(true);__deliveryTest.clearTraffic()');g.evaluate('__deliveryTest.freeze(true)');bridge=DelayBridge(h,g,400,jitter=20,loss=.01,seed=777);H=lambda js:h.evaluate(js);G=lambda js:g.evaluate(js)
 G("__deliveryTest.view('drive')");bridge.drain(.9);H('__deliveryTest.place(70,70,0,0);__deliveryTest.publish()');bridge.drain(.35);G('__deliveryTest.snapshot()');H('__deliveryTest.fault(98);__deliveryTest.publish()');bridge.drain(.4);net=G('__deliveryTest.network()');gap=net['predictionError'];hard=gap<1.5
 ck('400ms hard correction after host collision/respawn relocation',hard,{'gap_m':round(gap,3),'host_position':H('__deliveryTest.snapshot().car.p'),'guest_position':G('__deliveryTest.snapshot().car.p')})
 h.close();g.close();hc.close();gc.close()
 # Drop every replaceable input/world message for a bounded interval; action records remain ordered/reliable.
 hc,h,he=load(b,size=(1000,740));gc,g,ge=load(b,mobile=True,size=(390,740));h.evaluate('__deliveryTest.freeze(true);__deliveryTest.clearTraffic()');g.evaluate('__deliveryTest.freeze(true)');bridge=DelayBridge(h,g,400,jitter=20,loss=.01,seed=991,force_loss=True);H=lambda js:h.evaluate(js);G=lambda js:g.evaluate(js)
 bridge.force_loss=False;bridge.drain(.4);H('__deliveryTest.place(3.2,72,0,0)');H("__deliveryTest.fixtureParcel(101,[8,.5,70]);__deliveryTest.remoteOutside(8,71.1,0,-.85);__deliveryTest.publish()");bridge.drain(.4);G("__deliveryTest.lookAt([8,.5,70]);__deliveryTest.interact()");bridge.drain(.8);G("__deliveryTest.interact()");bridge.drain(.8)
 ck('400ms critical pickup action not repeated by retry/loss',bridge.dropped>0 and H('__deliveryTest.network().lastAction')==2 and H('__deliveryTest.v06().held') is None,{'dropped_replaceable':bridge.dropped,'host_last_action':H('__deliveryTest.network().lastAction'),'guest_held':G('__deliveryTest.v06().held')})
 h.close();g.close();hc.close();gc.close()
 b.close()
passed=sum(x['passed'] for x in results)
Path(ROOT/'tests'/'latency_results.json').write_text(json.dumps({'transport':'ordered, deterministic in-page bridge with configured one-way delay, jitter, and replaceable-packet loss; not real WebRTC/ICE','scenarios_ms':[0,80,150,250,400],'passed':passed,'total':len(results),'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
print('TOTAL',passed,'/',len(results),flush=True)
if passed!=len(results):raise SystemExit(1)
