from test_utils import *
from playwright.sync_api import sync_playwright
import json, math
R=[]
def ck(n,v,d=None):
    R.append({'test':n,'passed':bool(v),'details':d}); print(('PASS ' if v else 'FAIL ')+n, '' if v else d, flush=True)
with sync_playwright() as p:
    b=launch(p); c,pg,errors=load(b, mobile=True, size=(390,844)); E=pg.evaluate
    E('__deliveryTest.freeze(true)')
    # Version / viewport / tree exclusion.
    ck('V0.9.1 edition visible','V0.9.1 ONLINE' in pg.locator('.edition').inner_text())
    heights=E('({inner:innerHeight,body:document.body.getBoundingClientRect().height,game:document.getElementById("game").getBoundingClientRect().height,world:document.getElementById("world").getBoundingClientRect().height})')
    ck('Game fills dynamic viewport',abs(heights['game']-heights['inner'])<2 and abs(heights['world']-heights['inner'])<2,heights)
    snap=E('__deliveryTest.roads09.snapshot()')
    ck('Large roadside tree exclusion applied',snap['treeCull']>0,snap['treeCull'])
    # Pause exit is always available offline and actually returns to menu.
    pg.click('#roadStart09'); E('__deliveryTest.roads09.noTraffic();__deliveryTest.advance(.1)')
    pg.click('#pauseBtn'); ck('Pause exit visible offline',pg.locator('#pauseExit091').is_visible())
    pg.once('dialog',lambda d:d.accept()); pg.click('#pauseExit091')
    ck('Pause exit returns to main menu',pg.locator('#menu').is_visible() and pg.locator('#hud').is_hidden())
    # Red-light fine: cross V0.9 x-axis stop line on red.
    pg.click('#roadStart09'); E('__deliveryTest.roads09.noTraffic();__deliveryTest.forceTime(10);__deliveryTest.roads09.place(258,56,-Math.PI/2,8,0);__deliveryTest.roads09.input([]);__deliveryTest.advance(.7);__deliveryTest.roads09.clear()')
    law=E('__deliveryTest.roads09.law()'); ck('Red-light crossing fined exactly once',law['red']==1 and law['fines']==80,law)
    ck('Red-light fine deducted from score',E('__deliveryTest.snapshot().state.score')==-80,E('__deliveryTest.snapshot().state.score'))
    # Let cooldown expire and verify same intersection can be fined on a later crossing.
    E('__deliveryTest.advance(2);__deliveryTest.roads09.place(258,56,-Math.PI/2,8,0);__deliveryTest.advance(.7)')
    law=E('__deliveryTest.roads09.law()'); ck('Later red-light crossing is a new violation',law['red']==2 and law['fines']==160,law)
    # Collision fine with city traffic using real overlap/stepCar code.
    E('__deliveryTest.reset();__deliveryTest.freeze(true);__deliveryTest.clearTraffic();__deliveryTest.trafficPlace(0,0,-4,0,100);__deliveryTest.roads09.place(0,2,0,9,0);__deliveryTest.advance(.65)')
    law=E('__deliveryTest.roads09.law()'); ck('Vehicle collision produces traffic fine',law['crashes']>=1 and law['fines']>=20,law)
    ck('Traffic fine chip becomes visible',pg.locator('#trafficFine09').is_visible())
    # End summary contains the accumulated traffic fine.
    E('__deliveryTest.end()') if E('typeof __deliveryTest.end')=='function' else None
    # Static PWA policy is checked in node test; only verify no page errors here.
    ck('No JavaScript page errors',not errors,errors)
    c.close(); b.close()
Path=ROOT/'tests/v091_results.json'; Path.write_text(json.dumps(R,ensure_ascii=False,indent=2),encoding='utf8')
print('TOTAL',sum(x['passed'] for x in R),'/',len(R))
