#!/usr/bin/env python3
from pathlib import Path
import argparse,hashlib,json,re,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parent
BASE=ROOT/"src"/"v01051-texture-baseline.html";BASE_SHA="819cb8235db907891f4a71353a0a2397123aa4de2104caa55e743a7ef7a46d35"
p=argparse.ArgumentParser();p.add_argument("--output",type=Path,default=ROOT/"index.html");args=p.parse_args()
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA:raise RuntimeError("Unexpected V0.10.5.1 baseline")
html=data.decode("utf-8")
html=html.replace("<title>暴力快递 · V0.10.5.1 TEXTURE DOORS · PWA FULLSCREEN</title>","<title>暴力快递 · V0.10.5.1 NATIVE DOORS · PWA FULLSCREEN</title>",1)
html=html.replace("const NET_PROTOCOL='crash-delivery-mp01051-1';","const NET_PROTOCOL='crash-delivery-mp01051n-1';",1)
html=html.replace("V0.10.5.1 ONLINE <span>TEXTURE DOORS</span>","V0.10.5.1 ONLINE <span>NATIVE DOORS</span>",1)
runtime=(ROOT/"src"/"v01051-native-door.js").read_text(encoding="utf-8").strip();anchor="\n})();\n</script>";pos=html.rfind(anchor)
if pos<0:raise RuntimeError("Main closure not found")
html=html[:pos]+"\n"+runtime+"\n"+html[pos:]
if shutil.which("node"):
 with tempfile.TemporaryDirectory() as d:
  for i,js in enumerate(re.findall(r"<script[^>]*>(.*?)</script>",html,re.S)):
   f=Path(d)/f"s{i}.js";f.write_text(js,encoding="utf-8");subprocess.run(["node","--check",str(f)],check=True)
args.output.write_text(html,encoding="utf-8");sha=hashlib.sha256(html.encode()).hexdigest()
(ROOT/"VERSION_V09.json").write_text(json.dumps({"version":"0.10.5.1","name":"NATIVE DOORS / PWA FULLSCREEN","protocol":"crash-delivery-mp01051n-1","parent_index_sha256":BASE_SHA,"html_sha256":sha,"notes":"No added garage-door model or garage-door texture. Industrial delivery triggers sit directly in front of the existing Kenney factory garage facade; only the optional yellow ground outline remains."},ensure_ascii=False,indent=2),encoding="utf-8")
tmpl=(ROOT/"src"/"sw-template.js").read_text(encoding="utf-8").replace("V0.10.5.1","V0.10.5.1-native")
(ROOT/"sw.js").write_text(tmpl.replace("__BUILD_HASH__",sha[:16]),encoding="utf-8")
print("Built V0.10.5.1 native doors",len(html.encode()),sha)
