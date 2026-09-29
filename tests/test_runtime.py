from harness import Browser,QA
import json,math
checks=[]
def ck(n,ok,d=None):
 checks.append({'name':n,'passed':bool(ok),'detail':d});print(('PASS' if ok else 'FAIL'),n,str(d)[:120],flush=True)
with Browser() as x:
 p=x.page;ck('boot without JS errors',not x.errors,x.errors);info=p.evaluate('__deliveryTest.suburban011.info()');(QA/'runtime-info.json').write_text(json.dumps(info,indent=2));ck('assets initialized',info['ready'] and not info['error']);ck('22 homes / six deliveries',len(info['homes'])==22 and sum(h['role']=='delivery' for h in info['homes'])==6);ck('no road or house overlap',p.evaluate('(()=>{const a=__deliveryTest.suburban011.audit();return !a.overlaps.length&&!a.roadConflicts.length})()'))
 for num in range(101,107):
  for i,g in enumerate(next(h for h in info['homes'] if h['num']==num)['gates']):
   p.evaluate('__deliveryTest.suburban011.reset()');p.evaluate('([n,i])=>__deliveryTest.suburban011.fire(n,i)',[num,i]);p.evaluate('__deliveryTest.advance(.8)');r=p.evaluate('__deliveryTest.suburban011.raw()');ck(f'#{num} {g["kind"]} {i}',r['state']['delivered']==1,r['state'])
 p.evaluate('__deliveryTest.suburban011.reset()')
 for num in range(101,119):
  p.evaluate('(n)=>__deliveryTest.suburban011.fire(n,0)' if num<107 else '(n)=>__deliveryTest.v0102.fire(n,{distance:8,speed:25})',num);p.evaluate('__deliveryTest.advance(.8)');r=p.evaluate('__deliveryTest.suburban011.raw()');ck(f'18-order sequence {num}',r['state']['delivered']==num-100,r['state'])
 p.evaluate('__deliveryTest.suburban011.reset();__deliveryTest.suburban011.fire(101,0,0,0,102);__deliveryTest.advance(.8)');r=p.evaluate('__deliveryTest.suburban011.raw()');ck('wrong order not consumed',r['state']['delivered']==0 and any(a['order']==102 and not a['done'] for a in r['parcels']))
 p.evaluate('__deliveryTest.suburban011.reset();__deliveryTest.suburban011.fire(101,0,2,2);__deliveryTest.advance(.8)');ck('blank facade not delivery',p.evaluate('__deliveryTest.suburban011.raw().state.delivered')==0)
 for num in range(101,107):
  h=next(h for h in info['homes'] if h['num']==num);p.evaluate('__deliveryTest.suburban011.reset()');r=p.evaluate('([x,z,yaw,d])=>{__deliveryTest.place(x+Math.sin(yaw)*(d/2+10),z+Math.cos(yaw)*(d/2+10),yaw,18);__deliveryTest.advance(1.3);return __deliveryTest.snapshot().car}',[h['x'],h['z'],h['yaw'],h['d']]);dz=math.sin(h['yaw'])*(r['p'][0]-h['x'])+math.cos(h['yaw'])*(r['p'][2]-h['z']);ck(f'car hull outside {num}',dz>=h['d']/2+3.65,round(dz,3))
 for w,h in [(390,844),(320,640),(844,390),(1280,820)]:
  p.set_viewport_size({'width':w,'height':h});p.evaluate('window.__qaRAF=true;window.dispatchEvent(new Event("resize"))');p.wait_for_timeout(180);p.evaluate('window.__qaRAF=false')
  for mode in ['menu','game','pause']:
   p.evaluate('__deliveryTest.menu()' if mode=='menu' else '__deliveryTest.reset()' if mode=='game' else '__deliveryTest.pause()');el={'menu':'menu','game':'hud','pause':'pauseScreen'}[mode]
   r=p.evaluate('(ids)=>ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [r.top,r.height,r.width]})',['game','world',el]);ck(f'{w}x{h} {mode}',all(abs(z[0])<.1 and abs(z[1]-h)<1 and abs(z[2]-w)<1 for z in r),r)
 p.evaluate('__deliveryTest.suburban011.reset()');ck('driver hides jump',p.locator('#boardBtn').evaluate('(el)=>getComputedStyle(el).display==="none"'));p.evaluate('__deliveryTest.view("cargo");__deliveryTest.advance(.1)');ck('cargo keeps jump',p.locator('#boardBtn').evaluate('(el)=>getComputedStyle(el).display!=="none"'));ck('no later errors',not x.errors,x.errors)
(QA/'runtime_results.json').write_text(json.dumps({'checks':checks,'limit':'Actual JS/DOM/physics with supplied assets; GPU API stubbed. Not a WebGL driver/shader or iPhone test.'},ensure_ascii=False,indent=2));print('TOTAL',sum(x['passed'] for x in checks),'/',len(checks))
