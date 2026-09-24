"""Guest foot movement prediction/replay under deterministic delay, jitter, and loss."""
import json, math, random, time
from pathlib import Path
from test_utils import *
from playwright.sync_api import sync_playwright

class MovementBridge:
 def __init__(self,h,g,rtt,jitter=0,loss=.0,seed=17):
  self.h,self.g=h,g;self.half=rtt/2000;self.jitter=jitter/1000;self.loss=loss;self.drop_interval=max(1,round(1/loss)) if loss else 0;self.eligible=0;self.rng=random.Random(seed);self.q=[];self.last=[0,0];self.dropped=0;self.sent=0
  for pg,mode in [(h,'host'),(g,'guest')]:
   pg.evaluate("mode=>{window.wireOut=[];window.wire={readyState:'connecting',bufferedAmount:0,send:s=>wireOut.push(s),close:()=>{wire.readyState='closed';wire.onclose?.();}};__deliveryTest.attachRTC(wire,mode);}",mode)
  h.evaluate("wire.readyState='open';wire.onopen()")
  g.evaluate("wire.readyState='open';wire.onopen()")
  self.pump(.08)
 def pump(self,seconds=.05):
  end=time.monotonic()+seconds
  while True:
   now=time.monotonic()
   for direction,(src,dst) in enumerate([(self.h,self.g),(self.g,self.h)]):
    for raw in src.evaluate('wireOut.splice(0)'):
     self.sent+=1
     try:msg=json.loads(raw)
     except Exception:continue
     if msg.get('t') in ('input','world'):
      self.eligible+=1
      if self.drop_interval and self.eligible%self.drop_interval==0:self.dropped+=1;continue
     due=max(now+self.half+self.rng.uniform(-self.jitter,self.jitter),self.last[direction]+.0001)
     self.last[direction]=due;self.q.append((due,dst,raw))
   now=time.monotonic();ready=[x for x in self.q if x[0]<=now];self.q=[x for x in self.q if x[0]>now]
   for _,dst,raw in ready:dst.evaluate('s=>wire.onmessage({data:s})',raw)
   if now>=end:break
   self.h.wait_for_timeout(4)
 def run(self,seconds):
  end=time.monotonic()+seconds
  while time.monotonic()<end:self.pump(min(.035,max(.004,end-time.monotonic())))

results=[]
def record(name,ok,metrics):
 results.append({'test':name,'passed':bool(ok),'metrics':metrics});print(('PASS ' if ok else 'FAIL ')+name,metrics if not ok else '',flush=True)

with sync_playwright() as pw:
 browser=launch(pw)
 for rtt in (int(x) for x in os.environ.get('MOVEMENT_RTTS','0,100,250,400').split(',')):
  hctx,h,he=load(browser,size=(1000,740));gctx,g,ge=load(browser,mobile=True,size=(390,740))
  bridge=MovementBridge(h,g,rtt,jitter=22 if rtt else 0,loss=.02,seed=120+rtt)
  H=lambda js:h.evaluate(js);G=lambda js:g.evaluate(js)
  bridge.run(.25)
  g.wait_for_function("window.__deliveryTest.movement().authoritative!==null",timeout=10000)
  bridge.run(.10)
  H('__deliveryTest.place(0,0,0,10);__deliveryTest.publish()');bridge.run(.12);car_start=H('__deliveryTest.snapshot().car')
  base=G('__deliveryTest.snapshot().player.p')
  G("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}))")
  H("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',bubbles:true}))")
  first=G("()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(__deliveryTest.snapshot().player.p)))")
  first_frame=math.dist(base,first)
  g.wait_for_timeout(104)
  moved=G('__deliveryTest.snapshot().player.p');instant=math.dist(base,moved)
  active=G('__deliveryTest.controls()');during=G('__deliveryTest.movement()')
  bridge.run(.08)
  G("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',bubbles:true}))");H("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',bubbles:true}))")
  bridge.run(1.4)
  G("window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD',bubbles:true}))");H("window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA',bubbles:true}))")
  bridge.run(1.8)
  bridge.run(.45)
  host=H('__deliveryTest.network().remote.p');guest=G('__deliveryTest.movement()');net=G('__deliveryTest.network()')
  gap=math.dist(host,guest['predicted']) if guest['predicted'] else 999
  car_end=H('__deliveryTest.snapshot().car');car_travel=math.dist(car_start['p'],car_end['p']);car_turn=abs(math.atan2(math.sin(car_end['yaw']-car_start['yaw']),math.cos(car_end['yaw']-car_start['yaw'])))
  final_metrics={'first_frame_local_distance_m':round(first_frame,4),'local_120ms_distance_m':round(instant,3),'vehicle_travel_m':round(car_travel,2),'vehicle_turn_rad':round(car_turn,3),'pre_release_position':moved,'start_position':base,'movement_at_sample':during,'active_controls_at_sample':active,'final_host_guest_gap_m':round(gap,3),'max_reconciliation_error_m':round(guest['maxReconciliationError'],3),'mean_reconciliation_error_m':round(guest['averageReconciliationError'],3),'hard_corrections':guest['hardCorrections'],'unacked_inputs':guest['unackedInputs'],'snapshot_buffer':guest['snapshotBuffer'],'dropped_replaceable':bridge.dropped,'eligible_replaceable':bridge.eligible,'configured_loss':bridge.loss,'sent':bridge.sent,'mobile_view':(390,740),'space':guest['space'],'mode':guest['mode'],'switch_remaining_s':round(guest['switchRemaining'],3),'controls_after_release':G('__deliveryTest.controls()'),'transport':'deterministic delayed in-page bridge'}
  loss_exercised=bridge.dropped>0
  record(f'{rtt}ms cargo local WASD responds in-frame during vehicle motion and converges',first_frame>.005 and instant>.045 and gap<.65 and car_travel>2 and car_turn>.02 and guest['space']=='vehicle-local' and guest['unackedInputs']<=256 and guest['hardCorrections']==1 and loss_exercised,final_metrics)
  record(f'{rtt}ms render and predicted simulation remain finite',all(math.isfinite(x) for x in guest['render']+guest['predicted']+guest['authoritative']),final_metrics)
  record(f'{rtt}ms moving courier snapshot buffer remains bounded',guest['snapshotBuffer']<=12 and guest['interpolationBufferMs']<=220,final_metrics)
  record(f'{rtt}ms Chromium runtime remains clean',not he and not ge,{'host':he,'guest':ge})
  g.bring_to_front();G('__deliveryTest.placePredictedPlayer(0,0)');stick_start=G('__deliveryTest.movement().predicted');seq0=G('__deliveryTest.inputState().seq')
  stick_direction=G("(()=>{const p=__deliveryTest.movement().predicted;return p[2]>1?1:-1})()")
  G("(()=>{const e=document.getElementById('joystick'),r=e.getBoundingClientRect(),dy=__deliveryTest.movement().predicted[2]>1?34:-34;e.dispatchEvent(new PointerEvent('pointerdown',{pointerId:77,pointerType:'touch',clientX:r.left+r.width/2,clientY:r.top+r.height/2+dy,bubbles:true}));})()")
  held_stick=G('__deliveryTest.controls().stick');
  g.wait_for_timeout(100);stick_moved=G('__deliveryTest.movement().predicted');seq_down=G('__deliveryTest.inputState().seq')
  G("(()=>{const e=document.getElementById('joystick'),r=e.getBoundingClientRect(),dy=__deliveryTest.movement().predicted[2]>1?34:-34;e.dispatchEvent(new PointerEvent('pointermove',{pointerId:77,pointerType:'touch',clientX:r.left+r.width/2+32,clientY:r.top+r.height/2+dy,bubbles:true}));e.dispatchEvent(new PointerEvent('pointerup',{pointerId:77,pointerType:'touch',clientX:r.left+r.width/2+32,clientY:r.top+r.height/2+dy,bubbles:true}));})()")
  stopped=G('__deliveryTest.controls().stick');release_pred=G('__deliveryTest.movement().predicted');g.wait_for_timeout(100);after_stop=G('__deliveryTest.movement().predicted');seq_end=G('__deliveryTest.inputState().seq');stick_metrics={'local_delta_m':round(math.dist(stick_start,stick_moved),3),'start':stick_start,'moved':stick_moved,'held_stick':held_stick,'stop_drift_m':round(math.dist(release_pred,after_stop),4),'direction':stick_direction,'seq_start':seq0,'seq_after_down':seq_down,'seq_after_direction_and_release':seq_end,'released_stick':stopped,'RTT_ms':rtt}
  record(f'{rtt}ms mobile joystick moves locally and stops on pointerup',math.dist(stick_start,stick_moved)>.02 and math.dist(release_pred,after_stop)<.04 and stopped==[0,0] and seq_end>seq_down>seq0,stick_metrics)
  if rtt==400:
   bridge.run(.35);target=G("(()=>{const p=__deliveryTest.movement().predicted;return [p[0]>0?-1.05:1.05, p[2]>0?-1.15:3.2]})()");H(f'__deliveryTest.remotePlace({target[0]},{target[1]});__deliveryTest.publish()');bridge.run(1.1);after_hard=G('__deliveryTest.movement()');authority=H('__deliveryTest.network().remote.p');hard_gap=math.dist(authority,after_hard['predicted']);record('400ms host courier relocation is applied on the guest',hard_gap<.15,{'position_gap_m':round(hard_gap,3),'host_actor':authority,'guest_prediction':after_hard['predicted']})
   hard_target=[-1.05 if after_hard['predicted'][0]>0 else 1.05,2.38,-1.15 if after_hard['predicted'][2]>0 else 3.2];probe=G(f'__deliveryTest.forceMovementSnapshot({json.dumps(hard_target)})');hard_metrics={'hard_before':probe['hardBefore'],'hard_after':probe['hardAfter'],'reconciliation_error_m':round(probe['error'],3),'max_reconciliation_error_m':round(probe['maxError'],3),'predicted':probe['predicted'],'authoritative':probe['authoritative']}
   record('400ms severe authority relocation uses one hard correction and converges',probe['hardAfter']==probe['hardBefore']+1 and probe['error']>3.2 and math.dist(probe['predicted'],probe['authoritative'])<.15,hard_metrics)
  hctx.close();gctx.close()
 ctx,pg,errors=load(browser,mobile=True,size=(390,740));cycles=pg.evaluate('__deliveryTest.mobilityRoundTrip(20)')
 record('20 cargo-local/world boarding cycles do not accumulate coordinate drift',cycles['cycles']==20 and cycles['finalView']=='cargo' and cycles['outsideWorldError']<.03 and cycles['cargoLocalDrift']<.001 and cycles['finite'],cycles)
 record('20 cargo/world transitions have no Chromium runtime errors',not errors,{'errors':errors})
 ctx.close()
 long_seconds=int(os.environ.get('MOVEMENT_LONG_SECONDS','0'))
 if long_seconds>0:
  hctx,h,he=load(browser,size=(1000,740));gctx,g,ge=load(browser,mobile=True,size=(390,740));bridge=MovementBridge(h,g,400,jitter=22,loss=.02,seed=909);H=lambda js:h.evaluate(js);G=lambda js:g.evaluate(js)
  bridge.run(.6);g.wait_for_function("window.__deliveryTest.movement().authoritative!==null",timeout=10000);H('__deliveryTest.place(0,0,0,10);__deliveryTest.publish()');H("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',bubbles:true}))");G("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}))");bridge.run(.5)
  direction='KeyW';steer='KeyA';max_history=max_snapshots=max_gap=0;error_start=G('__deliveryTest.movement()');car_start=H('__deliveryTest.snapshot().car');start=time.monotonic()
  for second in range(long_seconds):
   if second and second%2==0:
    next_direction=['KeyW','KeyD','KeyS','KeyA'][(second//2)%4];G(f"window.dispatchEvent(new KeyboardEvent('keyup',{{code:'{direction}',bubbles:true}}));window.dispatchEvent(new KeyboardEvent('keydown',{{code:'{next_direction}',bubbles:true}}))");direction=next_direction
   if second and second%6==0:
    next_steer='KeyD' if steer=='KeyA' else 'KeyA';H(f"window.dispatchEvent(new KeyboardEvent('keyup',{{code:'{steer}',bubbles:true}}));window.dispatchEvent(new KeyboardEvent('keydown',{{code:'{next_steer}',bubbles:true}}))");steer=next_steer
   bridge.run(1)
   state_now=G('__deliveryTest.movement()');host_position=H('__deliveryTest.network().remote.p');max_history=max(max_history,state_now['unackedInputs']);max_snapshots=max(max_snapshots,state_now['snapshotBuffer']);max_gap=max(max_gap,math.dist(host_position,state_now['predicted']))
   if (second+1)%30==0:print(f'LONG {second+1}/{long_seconds}s max_error={state_now["maxReconciliationError"]:.3f}m history={max_history} snapshots={max_snapshots}',flush=True)
  G(f"window.dispatchEvent(new KeyboardEvent('keyup',{{code:'{direction}',bubbles:true}}))");H(f"window.dispatchEvent(new KeyboardEvent('keyup',{{code:'KeyW',bubbles:true}}));window.dispatchEvent(new KeyboardEvent('keyup',{{code:'{steer}',bubbles:true}}))");bridge.run(3)
  after=G('__deliveryTest.movement()');authority=H('__deliveryTest.network().remote.p');gap=math.dist(authority,after['predicted']);car_end=H('__deliveryTest.snapshot().car');elapsed=time.monotonic()-start
  long_metrics={'wall_seconds':round(elapsed,1),'simulated_steps':long_seconds,'configured_rtt_ms':400,'jitter_ms':22,'configured_replaceable_loss':.02,'lost_replaceable':bridge.dropped,'eligible_replaceable':bridge.eligible,'maximum_reconciliation_error_m':round(after['maxReconciliationError'],3),'mean_reconciliation_error_m':round(after['averageReconciliationError'],3),'maximum_sampled_host_guest_gap_m':round(max_gap,3),'gap_after_release_m':round(gap,3),'hard_corrections':after['hardCorrections'],'maximum_unacked_history':max_history,'maximum_remote_snapshot_buffer':max_snapshots,'final_unacked_history':after['unackedInputs'],'final_snapshot_buffer':after['snapshotBuffer'],'vehicle_travel_m':round(math.dist(car_start['p'],car_end['p']),2),'runtime_errors':he+ge,'transport':'deterministic ordered in-page bridge, not real WebRTC/Cloudflare TURN'}
  record(f'{long_seconds}s continuous 400ms cargo movement stays bounded and converges',elapsed>=long_seconds-3 and bridge.dropped>0 and after['hardCorrections']==1 and after['maxReconciliationError']<3.2 and max_history<=256 and max_snapshots<=12 and gap<.65 and not he and not ge,long_metrics)
  hctx.close();gctx.close()
 ctx,pg,errors=load(browser,mobile=True,size=(390,740));stress=pg.evaluate('__deliveryTest.movementStress(300)')
 record('5-minute movement simulation keeps input and snapshot history bounded',stress['simulatedSeconds']==300 and stress['frames']==18000 and stress['maxInputHistory']<=256 and stress['snapshotBuffer']<=12 and stress['finite'],stress)
 record('5-minute movement simulation has no Chromium runtime errors',not errors,{'errors':errors})
 ctx.close()
 browser.close()
passed=sum(x['passed'] for x in results)
out={'transport':'ordered test adapter with deterministic one-way delay, uniform jitter, and 1-2% replaceable packet loss; not real WebRTC or Cloudflare TURN','scenarios_ms':[0,100,250,400],'passed':passed,'total':len(results),'results':results}
Path(ROOT/'tests'/'movement_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('TOTAL',passed,'/',len(results),flush=True)
if passed!=len(results):raise SystemExit(1)
