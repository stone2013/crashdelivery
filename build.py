#!/usr/bin/env python3
"""Build Crash Delivery V0.10.5 INDUSTRIAL POLISH from verified V0.10.4."""
from pathlib import Path
import argparse,hashlib,json,re,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'src'/'v0104-baseline.html'
BASE_SHA='f301bece71299962515ed12afa71c9191d1bd50d85c9a862a8530e2ba4f966b2'
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'index.html');args=p.parse_args()
data=BASE.read_bytes()
if hashlib.sha256(data).hexdigest()!=BASE_SHA: raise RuntimeError('Unexpected V0.10.4 baseline')
html=data.decode('utf-8')

def one(old,new):
 global html
 n=html.count(old)
 if n!=1: raise RuntimeError(f'Patch anchor mismatch ({n}): {old[:100]}')
 html=html.replace(old,new,1)

one('<title>暴力快递 · V0.10.4 INDUSTRIAL PLACEMENT FIX · CITY LOOP</title>','<title>暴力快递 · V0.10.5 INDUSTRIAL POLISH · CITY LOOP</title>')
one("const NET_PROTOCOL='crash-delivery-mp0104-1';","const NET_PROTOCOL='crash-delivery-mp0105-1';")
one("V0.10.4：地面临街厂房 / 避开立交与匝道 / 车上投递 / 玻璃破洞 / 柔和光影。","V0.10.5：水泥工业区 / 库门朝路 / 门架指路牌 / 真实接触阴影 / PWA 全屏。")
one("edition.innerHTML='V0.10.4 ONLINE <span>INDUSTRIAL PLACEMENT</span>'","edition.innerHTML='V0.10.5 ONLINE <span>INDUSTRIAL POLISH</span>'")
one('驾驶时 WASD 开车、空格跳跃；V 进入货箱。','驾驶时 WASD 开车；V 进入货箱。')

# Kenney model's apparent frontage was reversed on several selected factories; flip only the visual asset.
one("const base=M.model([x,.12,z],[0,yaw,0]);const modelYaw=0; // V0.10.4: Kenney factory facade follows the same +Z frontage as the receiving bay",
    "const base=M.model([x,.12,z],[0,yaw,0]);const modelYaw=Math.PI; // V0.10.5: visual Kenney facade flipped so the factory front follows the road-facing receiving side")

# Replace the big rectangular fake van shadow with wheel contacts + narrow underbody contact.
one("const vanShadow=makeMesh(new MeshBuilder().box(3.8,.007,8,'#557875',[0,.095,0]));",
'''const vanShadowBuilder=new MeshBuilder();
for(const x of [-1.58,1.58])for(const z of [-2.60,2.38])vanShadowBuilder.cylinder(.62,.010,14,'#3e5655',[x,.095,z]);
vanShadowBuilder.box(1.55,.007,4.55,'#49605f',[0,.094,-.08]);
const vanShadow=makeMesh(vanShadowBuilder);''')

# Side-mounted highway boards are superseded by real overhead gantries in V0.10.5.
one("road095PairedSigns('sign-highway',194,8,8,-Math.PI/2,8.7,13.8);road095PairedSigns('sign-highway',250,56,0,-Math.PI/2,8.7,13.8);",
    "/* V0.10.5: side highway boards replaced by overhead gantry signs. */")

css=r'''<style id="v0105Css">
:root{--appH:100dvh;--appTop:0px}
html,body{height:var(--appH)!important;min-height:var(--appH)!important;max-height:var(--appH)!important;overflow:hidden!important;overscroll-behavior:none!important}
#game{position:fixed!important;left:0!important;right:0!important;top:var(--appTop)!important;bottom:auto!important;height:var(--appH)!important;min-height:var(--appH)!important;max-height:var(--appH)!important;overflow:hidden!important}
#world,#overlay,#hud,#vignette{height:100%!important;min-height:100%!important;max-height:100%!important}
#pauseScreen.modalScreen{position:fixed!important;left:0!important;right:0!important;top:0!important;bottom:auto!important;height:var(--appH)!important;min-height:var(--appH)!important;max-height:var(--appH)!important;overflow:hidden!important;padding-bottom:max(8px,var(--safeB))!important}
#pauseScreen>.modal{max-height:calc(var(--appH) - max(18px,var(--safeT)) - max(18px,var(--safeB)))!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch}
@media(display-mode:standalone){html,body,#game,#pauseScreen.modalScreen{height:var(--appH)!important;min-height:var(--appH)!important;max-height:var(--appH)!important}}
</style>'''
html=html.replace('</head>',css+'\n</head>',1)

runtime=(ROOT/'src'/'v0105-hotfix.js').read_text(encoding='utf-8').strip()
anchor='\n})();\n</script>'
pos=html.rfind(anchor)
if pos<0: raise RuntimeError('Main closure not found')
html=html[:pos]+'\n'+runtime+'\n'+html[pos:]

static=re.sub(r'<script[^>]*>.*?</script>','',html,flags=re.S);ids=re.findall(r'\bid="([^"\n]+)"',static)
if len(ids)!=len(set(ids)): raise RuntimeError('Duplicate static DOM IDs')
if shutil.which('node'):
 with tempfile.TemporaryDirectory() as d:
  for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',html,re.S)):
   f=Path(d)/f'script{i}.js';f.write_text(js,encoding='utf-8');subprocess.run(['node','--check',str(f)],check=True)
args.output.write_text(html,encoding='utf-8')
sha=hashlib.sha256(html.encode()).hexdigest()
version={'version':'0.10.5','name':'INDUSTRIAL POLISH / CONCRETE + GANTRY + PWA','protocol':'crash-delivery-mp0105-1','parent_release':'0.10.4 INDUSTRIAL PLACEMENT','parent_index_sha256':BASE_SHA,'html_sha256':sha,'notes':'Industrial district uses continuous gray concrete hardstanding; Kenney factory visuals are flipped to match road-facing receiving facades and retain 2.4m loading forecourts. Large directional signs use overhead gantries. Van rectangular fake shadow is replaced by wheel/underbody contact shadows. Explicit iOS/PWA viewport height sync prevents recurring bottom blank strip.'}
(ROOT/'VERSION_V09.json').write_text(json.dumps(version,ensure_ascii=False,indent=2),encoding='utf-8')
tmpl=(ROOT/'src'/'sw-template.js').read_text(encoding='utf-8').replace('V0.10.4','V0.10.5')
(ROOT/'sw.js').write_text(tmpl.replace('__BUILD_HASH__',sha[:16]),encoding='utf-8')
print('Built V0.10.5',args.output,len(html.encode()),'bytes',sha)
