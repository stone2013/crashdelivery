"""V0.9.4 integration tests. Uses real WebGL and transformed Kenney GLB geometry.
Scene fixtures place a test vehicle; normal driving/traffic updates are not mocked.
This is not Safari hardware / real TURN validation.
"""
from test_utils import *
from playwright.sync_api import sync_playwright
import json, math
R=[]
def ck(name, value, detail=None):
    R.append({'test':name, 'passed':bool(value), 'details':detail})
    print(('PASS ' if value else 'FAIL ')+name, '' if value else detail, flush=True)
with sync_playwright() as p:
    browser=launch(p); context,page,errors=load(browser); E=page.evaluate
    E('__deliveryTest.freeze(true)')
    ck('Current playable title and network protocol', 'V0.9.4 ALL ROADS' in page.title() and E('__deliveryTest.cityRoads094.protocol()')=='crash-delivery-mp094-1',page.title())
    ck('Embedded original GLB assets finish loading', E('__deliveryTest.roads09.snapshot().assets')==22 and E('window.__cityRoads094Ready && window.__roads09Ready'))
    page.screenshot(path=str(ROOT/'screenshots/v094_menu_desktop.png'))
    page.click('#startBtn');E('__deliveryTest.freeze(true)')
    ck('Solo button starts in renewed original city not test zone',E('__deliveryTest.snapshot().state.mode')=='playing' and E('__deliveryTest.roads09.snapshot().car.p[0]')<120)
    s=E('__deliveryTest.cityRoads094.snapshot()');c=E('__deliveryTest.city()')
    ck('Original graph: all 25 junctions and 38 streets preserved',s['junctions']==25 and s['streets']==38 and len(c['edges'])==38 and len(c['nodes'])==25)
    ck('101 real roadway modules cover the entire original city',s['roadTiles']==101)
    ck('All three districts and 18 addresses remain', c['orders']==18 and len(set(x['district'] for x in c['districts']))==3,c['districts'])
    junctions=[x for x in s['tiles'] if x.get('nodeId') is not None]
    ck('Crossroads, T-junctions and corners use separate GLB types',{'road-crossroad-path','road-intersection-path','road-bend'}.issubset({x['name'] for x in junctions}))
    ck('Legacy slabs/curbs removed from original world generator','V0.9.4: road geometry and signals are built' in SOURCE and s['originalSlabs']==0)
    # Audit lanes and joints against transformed TRIANGLES, not the route used to place those triangles.
    audit=E('__deliveryTest.cityRoads094.audit()')
    ck('Every directional street centerline lies on actual Kenney asphalt',not any(x['label'].startswith('lane:') for x in audit['failures']),audit['samples'])
    ck('All seams continuous at both road edges and both lanes',not any(x['label'].startswith('join:') for x in audit['failures']),audit['failures'][:10])
    ck('Every existing NPC turning spline stays within actual asphalt',not any(x['label'].startswith('turn:') for x in audit['failures']),audit['failures'][:10])
    (ROOT/'tests/city_roads_geometry_v094.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
    ck('Removed graph links remain non-road, not fake shortcuts',not E('__deliveryTest.cityRoads094.roadAt(-90,-56).length') and not E('__deliveryTest.cityRoads094.roadAt(90,0).length'))
    seam=E('Array.from({length:57},(_,i)=>__deliveryTest.cityRoads094.roadAt(112+i*.5,56))')
    ck('Original city connects seamlessly to SKYWAY entrance',all(any(abs(q['y']-.08)<.002 for q in rows) for rows in seam))
    ck('76 inward-facing street lamps and 64 graph-controlled signals',s['lamps']==76 and s['signals']==64,s)
    f=E('__deliveryTest.roads09.furniture()')
    ck('City + test-zone furniture supports are outside drivable surfaces',all(not x['onRoad'] for x in f),[x for x in f if x['onRoad']])
    o=E('__deliveryTest.cityRoads094.orientation()')
    sign_dots=[];lamp_dots=[]
    for x in o:
        y=x['travelYaw'];flow=[-math.sin(y),0,-math.cos(y)];right=[math.cos(y),0,-math.sin(y)]
        if 'light-curved'==x['name']:
            lamp_dots.append(sum(x['arm'][j]*(-right[j]*x['side']) for j in range(3)))
        else:
            sign_dots.append(sum(x['front'][j]*-flow[j] for j in range(3)))
    ck('Real model -X sign normals face arriving cars',bool(sign_dots) and min(sign_dots)>.98,{'count':len(sign_dots),'min':min(sign_dots)})
    ck('Real lamp -Z arms face the road, not the grass',bool(lamp_dots) and min(lamp_dots)>.98,{'count':len(lamp_dots),'min':min(lamp_dots)})
    phases=set()
    for t in range(30):
        E('__deliveryTest.forceTime('+str(t)+')')
        signals=E('__deliveryTest.cityRoads094.signals()')
        phases.update(x['phase'] for x in signals)
    ck('Live signals cycle through red/amber/green',phases=={'red','amber','green'},sorted(phases))
    ck('All signal poles are attached to graph degree >=3',all(len(c['nodes'][x['node']]['adj'])>=3 for x in signals))
    # Check red line crossing using unchanged road authority step.
    E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.clearTraffic();__deliveryTest.roads09.noTraffic()')
    sig=E('__deliveryTest.cityRoads094.signals()')
    sig=next(x for x in sig if abs(c['nodes'][x['node']]['x'])<60 and abs(c['nodes'][x['node']]['z'])<60 and x['axis']==2)
    node=c['nodes'][sig['node']];yaw=sig['travelYaw'];d=[-math.sin(yaw),-math.cos(yaw)];right=[math.cos(yaw),-math.sin(yaw)]
    redtime=next(t for t in range(25) if E('(t)=>{__deliveryTest.forceTime(t);return __deliveryTest.cityRoads094.signals().find(s=>s.node==='+str(sig['node'])+' && s.axis===2).phase}',t)=='red')
    x=node['x']-d[0]*12.5+right[0]*3.05;z=node['z']-d[1]*12.5+right[1]*3.05
    E(f'__deliveryTest.roads09.place({x},{z},{yaw},8,0);__deliveryTest.forceTime({redtime});__deliveryTest.advance(.7)')
    law=E('__deliveryTest.roads09.law()')
    ck('New city road red stop-line crossing produces existing $80 fine',law['red']==1 and law['fines']==80,law)
    # Keyboard driving still responds on the new asphalt.
    E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.clearTraffic();__deliveryTest.roads09.noTraffic();__deliveryTest.roads09.place(3.05,75,0,0,0)')
    page.keyboard.down('w');E('__deliveryTest.advance(1.4)');page.keyboard.up('w')
    car=E('__deliveryTest.roads09.snapshot().car')
    ck('WASD actually drives across new road surfaces',car['p'][2]<71 and car['speed']>3 and abs(car['p'][1]-.12)<.04,car)
    E('__deliveryTest.roads09.place(20,20,0,3,0);__deliveryTest.advance(.5)')
    grass=E('__deliveryTest.roads09.snapshot().car')
    ck('City grass remains drivable rather than an invisible wall',grass['p'][2]<20 and grass['p'][1]<.3,grass)
    # Two-minute full original traffic run sampled every two sim-seconds, avoids player obstruction.
    E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.roads09.place(330,120,0,0,0)')
    failures=[];count=0
    for i in range(60):
        E('__deliveryTest.advance(2)');snap=E('__deliveryTest.cityRoads094.trafficSurface()');count+=len(snap)
        failures.extend({'time':(i+1)*2,**x} for x in snap if not x['road'])
    traffic=E('__deliveryTest.city()')
    ck('Two-minute traffic run stays on actual mesh across all sampled frames',not failures,{'samples':count,'failures':failures[:20]})
    ck('Traffic continues completing junction turns',traffic['stats']['turns']>20,traffic['stats'])
    ck('NPCs stop for real signals and turn both directions',traffic['stats']['redStops']>0 and traffic['stats']['left']>0 and traffic['stats']['right']>0,traffic['stats'])
    E('__deliveryTest.roads09.city();__deliveryTest.clearTraffic();__deliveryTest.roads09.noTraffic();__deliveryTest.roads09.camera([28,23,87],[0,0,53])')
    page.screenshot(path=str(ROOT/'screenshots/v094_city_desktop.png'))
    E('__deliveryTest.roads09.camera([0,125,10],[0,0,0])')
    page.screenshot(path=str(ROOT/'screenshots/v094_city_overview.png'))
    E('__deliveryTest.roads09.camera([28,23,87],[0,0,53])')
    duel=E('__deliveryTest.cityRoads094.simulateDuelView()')
    ck('2v2 render mode does not hide the renewed city roads',duel['visible']>0 and duel['triangles']>0,duel)
    ck('City and test-zone batches use distinct region tags',{'city','skyway'}.issubset(set(x['region'] for x in E('__deliveryTest.cityRoads094.drawCounts().chunks'))))
    ck('No WebGL or JavaScript errors',E('__deliveryTest.glError()')==0 and not errors,errors)
    context.close()
    for size in [(320,640),(390,844),(844,390)]:
        ctx,pg,er=load(browser,mobile=True,size=size);F=pg.evaluate;pg.click('#startBtn');F('__deliveryTest.freeze(true);__deliveryTest.roads09.noTraffic()')
        dims=F('({w:innerWidth,h:innerHeight,gw:document.getElementById("game").getBoundingClientRect().width,gh:document.getElementById("game").getBoundingClientRect().height,d:document.documentElement.scrollWidth})')
        ck(f'Mobile {size} retains edge-to-edge viewport without overflow',abs(dims['gh']-size[1])<1 and abs(dims['gw']-size[0])<1 and dims['d']<=size[0],dims)
        ck(f'Mobile {size} ready, 18 orders, no runtime error',not er and F('__deliveryTest.roads09.coreCount().orders')==18 and F('__deliveryTest.glError()')==0,er)
        if size==(390,844):
            F('__deliveryTest.roads09.camera(null);__deliveryTest.roads09.place(3.05,72,0,0,0)');pg.wait_for_timeout(450)
            pg.screenshot(path=str(ROOT/'screenshots/v094_city_phone.png'))
        ctx.close()
    browser.close()
(ROOT/'tests/city_roads_v094_results.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
print('TOTAL',sum(r['passed'] for r in R),'/',len(R))
if not all(r['passed'] for r in R):raise SystemExit(1)
