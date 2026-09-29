from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf-8')
js=(ROOT/'src/v0105-hotfix.js').read_text(encoding='utf-8')
manifest=json.loads((ROOT/'manifest.webmanifest').read_text(encoding='utf-8'))
version=json.loads((ROOT/'VERSION_V09.json').read_text(encoding='utf-8'))
assert '<title>暴力快递 · V0.10.5 INDUSTRIAL POLISH · CITY LOOP</title>' in html
assert 'V0.10.5 ONLINE <span>INDUSTRIAL POLISH</span>' in html
assert "const NET_PROTOCOL='crash-delivery-mp0105-1';" in html
assert "const modelYaw=Math.PI" in html
assert "side highway boards replaced by overhead gantry signs" in html
assert "const vanShadowBuilder=new MeshBuilder()" in html
assert "box(3.8,.007,8,'#557875'" not in html
assert "#8d9698" in js and 'industrialBounds' in js
assert '2.0,4.0' in js or "clamp(h.setback012||2.4,2.0,4.0)" in js
assert 'v0105AddGantry' in js and "'INDUSTRY'" in js and "'SKYWAY'" in js
assert 'v0105SyncViewport' in js and '--appH' in html and '#pauseScreen.modalScreen' in html
assert manifest['name'].startswith('暴力快递 V0.10.5')
assert version['version']=='0.10.5' and version['protocol']=='crash-delivery-mp0105-1'
assert version['html_sha256']==hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest()
print('V0.10.5 static checks: PASS')
