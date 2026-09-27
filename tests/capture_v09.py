from test_utils import *
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=launch(p);c,pg,err=load(b,False,(1440,900));E=pg.evaluate
 E('__deliveryTest.freeze(true);__deliveryTest.roads09.start();__deliveryTest.roads09.place(217,8,-Math.PI/2,0,8);__deliveryTest.advance(.1)')
 E('__deliveryTest.roads09.camera([287,66,99],[222,2.5,29]);document.getElementById("hud").style.display="none";document.getElementById("overlay").style.visibility="hidden"')
 pg.wait_for_timeout(250);pg.screenshot(path=str(ROOT/'screenshots/v09_skyway_overview.png'))
 E('document.getElementById("hud").style.display="";document.getElementById("overlay").style.visibility="";__deliveryTest.roads09.camera([246,20,38],[213,5,8])')
 pg.wait_for_timeout(180);pg.screenshot(path=str(ROOT/'screenshots/v09_bridge_upper.png'))
 E('__deliveryTest.roads09.place(224,27,0,0,0);__deliveryTest.advance(.1);__deliveryTest.roads09.camera([236,6,35],[224,3,8])')
 pg.wait_for_timeout(180);pg.screenshot(path=str(ROOT/'screenshots/v09_underpass.png'))
 E('__deliveryTest.roads09.map()');pg.screenshot(path=str(ROOT/'screenshots/v09_city_guide.png'))
 assert not err,err
 c.close();b.close()
