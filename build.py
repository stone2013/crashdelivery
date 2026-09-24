#!/usr/bin/env python3
"""Rebuild the V0.7.2 release HTML and run static/JS checks."""
from pathlib import Path
import re, subprocess, shutil, tempfile
ROOT=Path(__file__).resolve().parent
release=ROOT/'src'/'release-v071.snapshot.html'
if not release.exists(): raise RuntimeError('Missing V0.7.1 release snapshot')
html=release.read_text(encoding='utf-8')
ids=re.findall(r'\bid="([^"\n]+)"',html)
if len(ids)!=len(set(ids)): raise RuntimeError('Duplicate DOM IDs')
required=set(re.findall(r"\$\('([^']+)'\)",html))
missing=required-set(ids)
if missing: raise RuntimeError('Missing DOM elements: '+', '.join(sorted(missing)))
if 'crash-delivery-mp071-1' not in html or 'V0.7.2 ONLINE' not in html or 'cleanIceUrls' not in html:
 raise RuntimeError('Release snapshot is not V0.7.2')
if shutil.which('node'):
 with tempfile.TemporaryDirectory() as d:
  for i,s in enumerate(re.findall(r'<script>(.*?)</script>',html,re.S)):
   f=Path(d)/f'script{i}.js';f.write_text(s,encoding='utf-8');subprocess.run(['node','--check',str(f)],check=True)
(ROOT/'index.html').write_text(html,encoding='utf-8')
print('Built V0.7.2 index.html:',len(html.encode()),'bytes;',len(ids),'unique DOM IDs; all direct refs valid.')
