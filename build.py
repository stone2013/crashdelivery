#!/usr/bin/env python3
"""Build the V0.7.5 baseline with the in-progress 2v2 mode runtime."""
import argparse
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
RELEASE = ROOT / 'src' / 'release-v071.snapshot.html'
DUEL_RULES = ROOT / 'src' / 'duel2v2-rules.js'
DUEL_RUNTIME = ROOT / 'src' / 'duel2v2-runtime.js'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'index.html',
                    help='output HTML path (defaults to index.html)')
args = parser.parse_args()

if not RELEASE.exists():
    raise RuntimeError('Missing V0.7.1 release snapshot')
html = RELEASE.read_text(encoding='utf-8')
if not DUEL_RULES.exists():
    raise RuntimeError('Missing 2v2 match rules module')
rules = DUEL_RULES.read_text(encoding='utf-8')
if not DUEL_RUNTIME.exists():
    raise RuntimeError('Missing 2v2 runtime adapter')
runtime = DUEL_RUNTIME.read_text(encoding='utf-8')
html = html.replace('</body>', '<script>\n' + rules + '\n</script>\n<script>\n' + runtime + '\n</script>\n</body>')
ids = re.findall(r'\bid="([^"\n]+)"', html)
if len(ids) != len(set(ids)):
    raise RuntimeError('Duplicate DOM IDs')
required = set(re.findall(r"\$\('([^']+)'\)", html))
missing = required - set(ids)
if missing:
    raise RuntimeError('Missing DOM elements: ' + ', '.join(sorted(missing)))
if ('crash-delivery-mp075-1' not in html or 'V0.7.5 ONLINE' not in html
        or 'cleanIceUrls' not in html or 'playersPanel' not in html
        or 'publicRoomsList' not in html or 'maxPlayers' not in html
        or 'DeliveryDuel2v2' not in html or 'FIRE_SECONDS_TO_EXPLOSION' not in html
        or 'V0.8.0 2v2 runtime adapter' not in runtime):
    raise RuntimeError('Release snapshot is not V0.7.5')
if shutil.which('node'):
    with tempfile.TemporaryDirectory() as directory:
        for index, script in enumerate(re.findall(r'<script>(.*?)</script>', html, re.S)):
            path = Path(directory) / f'script{index}.js'
            path.write_text(script, encoding='utf-8')
            subprocess.run(['node', '--check', str(path)], check=True)

args.output.parent.mkdir(parents=True, exist_ok=True)
with args.output.open('w', encoding='utf-8', newline='\n') as output:
    output.write(html)
print(f'Built V0.7.5 + 2v2 mode candidate {args.output}: {len(html.encode("utf-8")):,} bytes; '
      f'{len(ids)} unique DOM IDs; all direct refs valid.')
