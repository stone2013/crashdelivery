#!/usr/bin/env python3
"""Build Crash Delivery V0.10.5.1 TEXTURE DOORS / PWA FULLSCREEN."""
from pathlib import Path
import argparse,hashlib,json,re,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parent
BASE=ROOT/"src"/"v0105-baseline.html"
BASE_SHA="77db00ca06b463e3d44f8017df6cb40003b3503902c583ff87a7e82e5b2576f0"
p=argparse.ArgumentParser();p.add_argument("--output",type=Path,default=ROOT/"index.html");args=p.parse_args()
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA: raise RuntimeError("Unexpected V0.10.5 baseline")
html=data.decode("utf-8")
html=html.replace("<title>暴力快递 · V0.10.5 INDUSTRIAL POLISH · CITY LOOP</title>","<title>暴力快递 · V0.10.5.1 TEXTURE DOORS · PWA FULLSCREEN</title>",1)
html=html.replace("const NET_PROTOCOL='crash-delivery-mp0105-1';","const NET_PROTOCOL='crash-delivery-mp01051-1';",1)
html=html.replace("V0.10.5 ONLINE <span>INDUSTRIAL POLISH</span>","V0.10.5.1 ONLINE <span>TEXTURE DOORS</span>",1)
css='<style id="v01051Css">\n:root{--appH51:100lvh}\nhtml,body{margin:0!important;width:100%!important;height:var(--appH51)!important;min-height:var(--appH51)!important;max-height:var(--appH51)!important;overflow:hidden!important;background:#142b31!important}\n#game{position:fixed!important;inset:0!important;width:100%!important;height:var(--appH51)!important;min-height:var(--appH51)!important;max-height:var(--appH51)!important;overflow:hidden!important}\n#menu,#pauseScreen,#helpScreen,#endScreen{box-sizing:border-box!important}\n#menu{position:absolute!important;inset:0!important;min-height:100%!important;height:100%!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 24px)!important}\n#pauseScreen.modalScreen,#helpScreen.modalScreen,#endScreen.modalScreen{position:absolute!important;inset:0!important;height:100%!important;min-height:100%!important;overflow:hidden!important}\n#pauseScreen>.modal,#helpScreen>.modal,#endScreen>.modal{max-height:calc(var(--appH51) - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 24px)!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important}\n@supports(height:100lvh){html,body,#game{height:100lvh;min-height:100lvh}}\n</style>'
html=html.replace("</head>",css+"\n</head>",1)
runtime=(ROOT/"src"/"v01051-texture-pwa.js").read_text(encoding="utf-8").strip()
anchor="\n})();\n</script>"
pos=html.rfind(anchor)
if pos<0: raise RuntimeError("Main closure not found")
html=html[:pos]+"\n"+runtime+"\n"+html[pos:]
static=re.sub(r"<script[^>]*>.*?</script>","",html,flags=re.S);ids=re.findall(r'\bid="([^"\n]+)"',static)
if len(ids)!=len(set(ids)): raise RuntimeError("Duplicate DOM IDs")
if shutil.which("node"):
  with tempfile.TemporaryDirectory() as d:
    for i,js in enumerate(re.findall(r"<script[^>]*>(.*?)</script>",html,re.S)):
      f=Path(d)/f"script{i}.js";f.write_text(js,encoding="utf-8");subprocess.run(["node","--check",str(f)],check=True)
args.output.write_text(html,encoding="utf-8")
sha=hashlib.sha256(html.encode()).hexdigest()
version={"version":"0.10.5.1","name":"TEXTURE DOORS / PWA FULLSCREEN","protocol":"crash-delivery-mp01051-1","parent_release":"0.10.5 INDUSTRIAL POLISH","parent_index_sha256":BASE_SHA,"html_sha256":sha,"notes":"Removes extra 3D industrial receiving-bay geometry and draws garage doors, numbers and loading aprons as WebGL canvas-texture decals. Invisible delivery triggers remain authoritative. iOS standalone viewport uses physical screen height fallback so menu/game/pause backgrounds fill the full PWA screen."}
(ROOT/"VERSION_V09.json").write_text(json.dumps(version,ensure_ascii=False,indent=2),encoding="utf-8")
tmpl=(ROOT/"src"/"sw-template.js").read_text(encoding="utf-8").replace("V0.10.5","V0.10.5.1")
(ROOT/"sw.js").write_text(tmpl.replace("__BUILD_HASH__",sha[:16]),encoding="utf-8")
print("Built V0.10.5.1",len(html.encode()),sha)
