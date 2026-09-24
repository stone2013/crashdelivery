from test_utils import *
from playwright.sync_api import sync_playwright
import json,math
res=[]
def ck(n,ok,details=None):
 res.append({'test':n,'passed':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+n,details if not ok else '',flush=True)
with sync_playwright() as p:
 b=launch(p);cx,pg,errs=load(b);E=pg.evaluate
 pg.click('#startBtn');E('__deliveryTest.freeze(true);__deliveryTest.place(25,100,0,0)')
 city=lambda:E('__deliveryTest.city()')
 def trafficReset():E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.cityClearTraffic();__deliveryTest.place(25,100,0,0)')
 c=city();ck('30 buildings / 18 order parcels / three districts',c['buildings']==30 and c['orders']==18 and len(set(x['district'] for x in c['districts']))==3)
 nodes=c['nodes'];seen={0};todo=[0]
 while todo:
  for v in nodes[todo.pop()]['adj']:
   if v not in seen:seen.add(v);todo.append(v)
 ck('Finite city graph fully connected',len(seen)==25)
 ck('Real T junctions and corners',any(len(x['adj'])==3 for x in nodes) and any(len(x['adj'])==2 for x in nodes))
 ck('Missing plaza roads absent from graph',all(not (nodes[e['a']]['x']==56 and nodes[e['a']]['z']==0 and nodes[e['b']]['x']==112 and nodes[e['b']]['z']==0) for e in c['edges']))
 ck('Spatial batches generated',c['batches']>9,c['batches'])
 # Red/green signals are mutually exclusive at every junction over a cycle.
 greenSafe=E('''()=>{for(let t=0;t<23;t+=.05)for(const n of __deliveryTest.city().nodes){if(__deliveryTest.citySignal(n.x,n.z,0,t)==='green'&&__deliveryTest.citySignal(n.x,n.z,2,t)==='green')return false;}return true;}''')
 ck('Conflicting traffic lights never green together',greenSafe)
 # Set origin node offset: (0,0) offset 4.26. At 8s NS red.
 trafficReset();E('__deliveryTest.cityTime(8);__deliveryTest.cityTrafficAt(0,0,56,0,0,34,[0,-56]);__deliveryTest.cityTrafficAdvance(2)')
 t=city()['traffic'][0];ck('Red light approach stops before crossing',t['motion']=='road' and t['p'][2]>=9.19 and t['wait']=='red',t)
 E('__deliveryTest.cityTrafficAdvance(2)');t=city()['traffic'][0];ck('Still cannot creep past a red stop line',t['motion']=='road' and t['p'][2]>=9.19,t)
 E('__deliveryTest.cityTime(19);__deliveryTest.cityTrafficAdvance(5)');t=city()['traffic'][0];ck('Green restarts traffic',t['motion']=='junction' or t['to']!=12,t)
 # Different approach, side turns exact cached curve.
 for turn,target in [('right',[56,0]),('left',[-56,0])]:
  trafficReset();E(f'__deliveryTest.cityTime(19);__deliveryTest.cityTrafficAt(0,0,56,0,0,34,{json.dumps(target)});__deliveryTest.cityTrafficAdvance(9)')
  t=city()['traffic'][0];ck(turn+' turn completed on connected exit',t['from']==12 and t['to']==(13 if turn=='right' else 11) and t['motion']=='road',t)
 # Same-lane queue on red, no interpenetration, no impact HP drain.
 trafficReset();E('__deliveryTest.cityTime(8);__deliveryTest.cityTrafficAt(0,0,56,0,0,34,[0,-56]);__deliveryTest.cityTrafficAt(1,0,56,0,0,15,[0,-56]);__deliveryTest.cityTrafficAdvance(5)')
 ts=city()['traffic'];gap=ts[1]['p'][2]-ts[0]['p'][2];ck('Following car forms a spaced queue',gap>=4.5 and ts[1]['phase']=='normal' and ts[0]['phase']=='normal',{'gap':gap,'cars':ts[:2]})
 # Wreck ahead induces blockage and route penalty then clears.
 trafficReset();E("__deliveryTest.cityTrafficAt(0,0,56,0,0,0,[0,-56]);__deliveryTest.cityIncident(1,[3.05,.1,24],'wreck');__deliveryTest.cityTrafficAdvance(5)")
 ts=city()['traffic'];ck('Wreck blocks traffic rather than being driven through',ts[0]['wait']=='incident' and ts[0]['p'][2]>28,ts[:2])
 ck('Accident edge appears on map',len(city()['blocked'])>=1,city()['blocked'])
 routes=E('__deliveryTest.cityRoute([0,56,0],[0,0,56])') # fixture y ignored; route assertion below
 E('__deliveryTest.cityTrafficAdvance(18)');ck('Timed road clearance removes wreck obstruction',city()['traffic'][1]['phase']=='cleared' and not city()['blocked'],city()['traffic'][1])
 E('__deliveryTest.cityTrafficAdvance(5)');ck('Queued traffic resumes after clearance',city()['traffic'][0]['p'][2]<27,city()['traffic'][0])
 # A route with a useful alternative avoids an obstructed edge.
 trafficReset();E("__deliveryTest.cityIncident(1,[3.05,.1,24],'wreck')")
 r=E('__deliveryTest.cityRoute([0,0,56],[0,0,-56])');ck('Navigation detours around blocked road', '12:17' not in r['edges'],r)
 # All 18 deliveries reachable by finite road, no NaN, stable message budget.
 ck('All jobs have finite road navigation',E('''()=>__deliveryTest.snapshot().houses.every(h=>Number.isFinite(__deliveryTest.cityRoute([3.2,0,72],[h.x,0,h.z]).length))'''))
 ck('Network snapshot fits 64 KiB',E('__deliveryTest.snapshotBytes()')<65536,E('__deliveryTest.snapshotBytes()'))
 # Run city without player causing incidents, check curve continuity and liveness.
 trafficReset();E('__deliveryTest.cityReset();__deliveryTest.place(25,100,0,0)');maxjump=0;old=city()['traffic'];autoCrash=False
 for i in range(60):
  E('__deliveryTest.cityTrafficAdvance(.5)');ts=city()['traffic'];autoCrash|=any(t['phase']!='normal' for t in ts)
  maxjump=max(maxjump,max(math.hypot(a['p'][0]-o['p'][0],a['p'][2]-o['p'][2]) for a,o in zip(ts,old)));old=ts
 ck('Traffic moves smoothly without intersection teleport',maxjump<7,{'max_0.5s_displacement':maxjump})
 ck('Ordinary traffic creates no spontaneous accidents',not autoCrash,[x for x in ts if x['phase']!='normal'])
 c=city();ck('City throughput: left and right turns observed',c['stats']['left']>0 and c['stats']['right']>0,c['stats'])
 ck('City finite state after simulation',E('''()=>__deliveryTest.city().traffic.every(t=>t.p.every(Number.isFinite)&&Number.isFinite(t.speed))'''))
 ck('No city runtime / GL errors',not errs and E('__deliveryTest.glError()')==0,errs)
 b.close()
(ROOT/'tests/city_results.json').write_text(json.dumps(res,ensure_ascii=False,indent=2))
print('TOTAL',sum(r['passed'] for r in res),'/',len(res))
