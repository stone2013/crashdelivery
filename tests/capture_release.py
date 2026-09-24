from test_utils import *
from test_bridge import Bridge
from playwright.sync_api import sync_playwright
import json
checks=[]
with sync_playwright() as p:
 b=launch(p);cx,pg,errs=load(b,size=(1440,900));E=pg.evaluate
 E('__deliveryTest.advance(0)');pg.wait_for_timeout(400);pg.screenshot(path=str(ROOT/'screenshots/v07_menu_desktop.png'))
 pg.click('#startBtn');E('__deliveryTest.freeze(true);__deliveryTest.place(59.05,42,0,0);__deliveryTest.selectOrder(107)');E('__deliveryTest.advance(0)');pg.wait_for_timeout(400)
 pg.screenshot(path=str(ROOT/'screenshots/v07_market_drive.png'))
 checks.append({'view':'market','render':E('__deliveryTest.city()')['visibleTriangles'],'total':E('__deliveryTest.snapshot().staticTriangles'),'batches':E('__deliveryTest.city().visibleBatches')})
 E('__deliveryTest.place(-108.95,48,0,0);__deliveryTest.selectOrder(118)');E('__deliveryTest.advance(0)');pg.wait_for_timeout(400);pg.screenshot(path=str(ROOT/'screenshots/v07_works_drive.png'))
 checks.append({'view':'works','render':E('__deliveryTest.city().visibleTriangles'),'total':E('__deliveryTest.snapshot().staticTriangles'),'batches':E('__deliveryTest.city().visibleBatches')})
 E('__deliveryTest.selectOrder(113);__deliveryTest.cityIncident(1,[3.05,.1,24],"wreck");__deliveryTest.openCityMap()');pg.wait_for_timeout(250);pg.screenshot(path=str(ROOT/'screenshots/v07_city_map_desktop.png'))
 # The drawing/photo is the rendered game, not a replacement camera/background.
 E('__deliveryTest.closeCityMap();__deliveryTest.place(59.05,29,0,0);__deliveryTest.outsideAt(56,29,-1.12,.1);__deliveryTest.fixtureParcel(107,[0,0,0],"held");__deliveryTest.aimAt(107,0)');pg.wait_for_timeout(300)
 pg.screenshot(path=str(ROOT/'screenshots/v07_market_cargo.png'))
 cx.close()
 mc,m,me=load(b,mobile=True,size=(390,740));M=m.evaluate;m.click('#startBtn');M('__deliveryTest.freeze(true);__deliveryTest.place(59.05,42,0,0);__deliveryTest.selectOrder(107)');M('__deliveryTest.advance(0)');m.wait_for_timeout(300)
 m.screenshot(path=str(ROOT/'screenshots/v07_phone_drive.png'))
 M('__deliveryTest.openCityMap()');m.wait_for_timeout(250);m.screenshot(path=str(ROOT/'screenshots/v07_phone_map.png'));mc.close()
 hc,h,he=load(b,size=(1280,800));gc,g,ge=load(b,mobile=True,size=(390,740));br=Bridge(h,g);H=h.evaluate;G=g.evaluate
 H('__deliveryTest.freeze(true);__deliveryTest.place(59.05,42,0,0);__deliveryTest.selectOrder(107);__deliveryTest.advance(0);__deliveryTest.publish()');br.advance(.6)
 h.screenshot(path=str(ROOT/'screenshots/v07_coop_driver.png'));g.screenshot(path=str(ROOT/'screenshots/v07_coop_cargo_phone.png'))
 (ROOT/'tests/render_observations.json').write_text(json.dumps({'views':checks,'errors':errs+me+he+ge},indent=2))
 b.close()
print(checks)
