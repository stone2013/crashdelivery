"""Two browser instances of the game; serialized, ordered test transport.
Not a WebRTC network test: this does not replace signaling/ICE acceptance tests.
"""
import time
from test_utils import *
class Bridge:
 def __init__(self,h,g):
  self.h,self.g=h,g; self.sent=[0,0];self.max_bytes=0
  for pg,mode in [(h,'host'),(g,'guest')]:
   pg.evaluate('''mode=>{window.wireOut=[];window.wire={readyState:'connecting',bufferedAmount:0,send:s=>wireOut.push(s),close:()=>{wire.readyState='closed';wire.onclose?.();}};__deliveryTest.attachRTC(wire,mode); }''',mode)
  h.evaluate("wire.readyState='open';wire.onopen()")
  g.evaluate("wire.readyState='open';wire.onopen()")
  self.pump(.5)
 def pump(self,seconds=.1):
  end=time.monotonic()+seconds
  while True:
   for i,(src,dst) in enumerate([(self.h,self.g),(self.g,self.h)]):
    msgs=src.evaluate('wireOut.splice(0)');self.sent[i]+=len(msgs)
    for m in msgs:self.max_bytes=max(self.max_bytes,len(m.encode()))
    if msgs:dst.evaluate('msgs=>{for(const s of msgs)wire.onmessage({data:s});}',msgs)
   if time.monotonic()>=end:break
   self.h.wait_for_timeout(15)
 def advance(self,s):
  self.pump(.07)
  self.h.evaluate('s=>__deliveryTest.advance(s)',s)
  self.h.evaluate('__deliveryTest.publish()')
  self.pump(.15)
