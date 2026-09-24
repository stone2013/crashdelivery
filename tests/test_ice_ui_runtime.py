import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_utils import launch,load
with sync_playwright() as p:
 b=launch(p);ctx,pg,errors=load(b,mobile=False,size=(1280,800))
 pg.locator('#networkBtn').click()
 pg.locator('#testIceBtn').click()
 pg.wait_for_timeout(7200)
 text=pg.locator('#iceDiag').inner_text()
 print(text)
 data={'diag':text,'errors':errors,'pass':('ICE 测试' in text or 'ICE candidate' in text) and not errors}
 Path(__file__).with_name('ice_ui_runtime.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 ctx.close();b.close()
 if not data['pass']:raise SystemExit(1)
