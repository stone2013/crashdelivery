#!/usr/bin/env python3
"""Build a genuinely offline, single HTML file from the readable source files."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'source'
PARTS=['setup.js','world.js','models.js','mechanics.js','projectiles.js','simulation.js','render.js','input.js']
html=(SOURCE/'layout.html').read_text(encoding='utf-8')
html=html.replace('/*__CSS__*/',(SOURCE/'style.css').read_text(encoding='utf-8'))
html=html.replace('/*__ENGINE__*/',(SOURCE/'engine.js').read_text(encoding='utf-8'))
html=html.replace('/*__GAME__*/','\n'.join((SOURCE/name).read_text(encoding='utf-8') for name in PARTS))
(ROOT/'index.html').write_text(html,encoding='utf-8')
print(f'Built {ROOT / "index.html"}: {len(html.encode("utf-8")):,} bytes')
