#!/usr/bin/env python3
"""Local static preview only. Game itself needs no Python once deployed."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, functools, threading, webbrowser
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--host',default='127.0.0.1')
p.add_argument('--port',type=int,default=8080)
p.add_argument('--no-open',action='store_true')
a=p.parse_args()
class Handler(SimpleHTTPRequestHandler):
 def end_headers(self):
  if self.path.split('?')[0].endswith(('.html','/sw.js','/manifest.webmanifest')):self.send_header('Cache-Control','no-cache')
  super().end_headers()
handler=functools.partial(Handler,directory=str(Path(__file__).resolve().parent))
try:
 server=ThreadingHTTPServer((a.host,a.port),handler)
except OSError as e:
 p.exit(1,f'Cannot start preview: {e}. Try --port 8081.\n')
url=f'http://127.0.0.1:{a.port}/index.html'
print('Crash Delivery V0.9:',url,'\nCtrl+C to stop. This does not modify GitHub or Cloudflare.',flush=True)
if not a.no_open:threading.Timer(.8,lambda:webbrowser.open(url)).start()
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
