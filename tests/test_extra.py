from harness import Browser,QA
import json
checks=[]
def ck(n,ok,d=None):checks.append({'name':n,'passed':bool(ok),'detail':d});print(('PASS' if ok else 'FAIL'),n,str(d)[:220],flush=True)
with Browser() as x:
 p=x.page
 for n in range(101,107):
  p.evaluate('__deliveryTest.suburban011.reset()');r=p.evaluate('(n)=>__deliveryTest.suburban011.movingThrow(n)',n);p.evaluate('__deliveryTest.advance(.85)');a=p.evaluate('__deliveryTest.suburban011.raw()');ck(f'moving cargo native delivery {n}',a['state']['delivered']==1 and a['state']['view']=='cargo',a['state'])
 p.evaluate('__deliveryTest.suburban011.reset();__deliveryTest.suburban011.host();__deliveryTest.suburban011.fire(101,1);__deliveryTest.advance(.8)');s=p.evaluate('__deliveryTest.suburban011.shared()');g=p.evaluate('__deliveryTest.suburban011.gates(101)');ck('host native glass hole recorded',bool(g[1]['holes']),g[1])
 p.evaluate('__deliveryTest.suburban011.reset()');p.evaluate('(m)=>__deliveryTest.suburban011.applyShared(m)',s);r=p.evaluate('__deliveryTest.suburban011.raw()');gs=p.evaluate('__deliveryTest.suburban011.gates(101)');ck('guest receives score/completion',r['state']['delivered']==1,r['state']);ck('guest glass position/seed matches',g[1]['holes']==gs[1]['holes'])
 p.evaluate('__deliveryTest.suburban011.reset()');s=p.evaluate('__deliveryTest.suburban011.shared()');ck('new protocol and 18 unique parcel orders',s['protocol']=='crash-delivery-mp011-1' and len({c['order'] for c in s['cargo']})==18)
 for n in range(101,107):
  p.evaluate('__deliveryTest.suburban011.reset()');a=p.evaluate('(n)=>__deliveryTest.suburban011.collisionParity(n)',n);ck(f'prediction collision parity {n}',max(abs(x-y) for x,y in zip(a['host'],a['predicted']))<.05,a)
 ck('no extra runtime errors',not x.errors,x.errors)
(QA/'extra_results.json').write_text(json.dumps({'checks':checks,'limits':'Offline snapshot application, not live internet multiplayer.'},ensure_ascii=False,indent=2))
