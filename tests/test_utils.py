from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=(ROOT/'index.html').read_text()
# Only enable the opt-in fixtures when loading into about:blank. Runtime code is unchanged.
TEST_SOURCE=SOURCE.replace("new URLSearchParams(location.search).has('test')","true")
ARGS=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
def load(b, mobile=False, size=(1280,800), name='page'):
 ctx=b.new_context(viewport={'width':size[0],'height':size[1]},has_touch=mobile,is_mobile=mobile,device_scale_factor=1)
 pg=ctx.new_page();errors=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.set_content(TEST_SOURCE,wait_until='load')
 pg.wait_for_function('window.__deliveryBootReady===true',timeout=12000)
 pg.evaluate('__deliveryTest.background(true)')
 pg.wait_for_timeout(150)
 return ctx,pg,errors

import os, shutil
def launch(p):
 kwargs={"headless":os.environ.get("HEADLESS")=="1","args":ARGS}
 executable=os.environ.get("CHROMIUM_EXECUTABLE") or shutil.which("chromium") or shutil.which("google-chrome")
 if executable:kwargs["executable_path"]=executable
 return p.chromium.launch(**kwargs)
