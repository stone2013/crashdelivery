import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_utils import launch, load

results=[]
def check(name, cond, detail=''):
    results.append({'name':name,'pass':bool(cond),'detail':detail})
    print(('PASS ' if cond else 'FAIL ')+name+((' '+detail) if detail else ''))

with sync_playwright() as p:
    b=launch(p)
    ctx,pg,errors=load(b,mobile=False,size=(1280,800))
    check('V0.7.3 boots', not pg.locator('#startBtn').is_disabled() and 'V0.7.3' in pg.title())
    pg.locator('#networkBtn').click()
    check('Network settings modal opens', pg.locator('#networkScreen').is_visible())
    check('Default network policy auto', pg.locator('#netPolicy').input_value()=='auto')
    cfg=pg.evaluate('__deliveryTest.rtcConfig()')
    urls=[x['urls'] for x in cfg['iceServers']]
    check('Default STUN configured', any(str(u).startswith('stun:') for u in urls), str(urls))
    check('Default policy allows direct', cfg['iceTransportPolicy']=='all')

    cfg=pg.evaluate("__deliveryTest.setNetworkSettings({policy:'auto',turnUrl:'turn:relay.example:3478',turnUser:'u',turnPass:'p'})")
    urls=[x['urls'] for x in cfg['iceServers']]
    check('Auto mode includes STUN and TURN', any(str(u).startswith('stun:') for u in urls) and any(str(u).startswith('turn:') for u in urls), str(urls))
    turn=[x for x in cfg['iceServers'] if str(x['urls']).startswith('turn:')][0]
    check('TURN credentials passed only to RTC config', turn.get('username')=='u' and turn.get('credential')=='p')

    cfg=pg.evaluate("__deliveryTest.setNetworkSettings({policy:'direct',turnUrl:'turn:relay.example:3478',turnUser:'u',turnPass:'p'})")
    urls=[x['urls'] for x in cfg['iceServers']]
    check('Direct mode excludes TURN', all(not str(u).startswith('turn:') for u in urls), str(urls))

    cfg=pg.evaluate("__deliveryTest.setNetworkSettings({policy:'relay',turnUrl:'turn:relay.example:3478',turnUser:'u',turnPass:'p'})")
    urls=[x['urls'] for x in cfg['iceServers']]
    check('Relay mode forces relay policy', cfg['iceTransportPolicy']=='relay')
    check('Relay mode contains TURN only', urls and all(str(u).startswith('turn:') for u in urls), str(urls))

    ns=pg.evaluate('__deliveryTest.networkSettings()')
    check('QA redacts TURN password', ns.get('turnPass')=='set')
    check('No page errors desktop', not errors, str(errors))
    ctx.close()

    for size in [(320,640),(390,740),(844,390)]:
        ctx,pg,errors=load(b,mobile=True,size=size)
        pg.locator('#networkBtn').click()
        box=pg.locator('#networkScreen .modal').bounding_box()
        overflow=pg.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
        check(f'{size[0]}x{size[1]} network UI visible', pg.locator('#networkScreen').is_visible())
        check(f'{size[0]}x{size[1]} network UI no horizontal overflow', overflow<=1, str(overflow))
        check(f'{size[0]}x{size[1]} controls tappable', pg.locator('#saveNetworkBtn').is_visible() and pg.locator('#testIceBtn').is_visible())
        check(f'{size[0]}x{size[1]} no JS errors', not errors, str(errors))
        ctx.close()
    b.close()

passed=sum(r['pass'] for r in results)
print('TOTAL',passed,'/',len(results))
Path(__file__).with_name('public_network_results.json').write_text(json.dumps({'passed':passed,'total':len(results),'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
if passed!=len(results): raise SystemExit(1)
