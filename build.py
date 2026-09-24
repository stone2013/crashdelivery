#!/usr/bin/env python3
"""Rebuild and validate the V0.7.4 three-player co-op release HTML."""
import argparse
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
RELEASE = ROOT / 'src' / 'release-v071.snapshot.html'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'index.html',
                    help='output HTML path (defaults to index.html)')
args = parser.parse_args()

if not RELEASE.exists():
    raise RuntimeError('Missing V0.7.1 release snapshot')
html = RELEASE.read_text(encoding='utf-8')
ids = re.findall(r'\bid="([^"\n]+)"', html)
if len(ids) != len(set(ids)):
    raise RuntimeError('Duplicate DOM IDs')
required = set(re.findall(r"\$\('([^']+)'\)", html))
missing = required - set(ids)
if missing:
    raise RuntimeError('Missing DOM elements: ' + ', '.join(sorted(missing)))
if ('crash-delivery-mp074-1' not in html or 'V0.7.4 ONLINE' not in html
        or 'cleanIceUrls' not in html or 'playersPanel' not in html):
    raise RuntimeError('Release snapshot is not V0.7.4')
if shutil.which('node'):
    with tempfile.TemporaryDirectory() as directory:
        for index, script in enumerate(re.findall(r'<script>(.*?)</script>', html, re.S)):
            path = Path(directory) / f'script{index}.js'
            path.write_text(script, encoding='utf-8')
            subprocess.run(['node', '--check', str(path)], check=True)

args.output.parent.mkdir(parents=True, exist_ok=True)
with args.output.open('w', encoding='utf-8', newline='\n') as output:
    output.write(html)
print(f'Built V0.7.4 {args.output}: {len(html.encode("utf-8")):,} bytes; '
      f'{len(ids)} unique DOM IDs; all direct refs valid.')
