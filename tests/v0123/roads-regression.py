#!/usr/bin/env python3
"""V0.12.3 native-roads regression: real Chromium WebGL/SwiftShader + real game physics.
The HTML/GLBs are supplied as authorized local bytes. This does not test HTTP
hosting, a service-worker lifecycle, public WebRTC, physical phones, or frame rate.
"""
import argparse, hashlib, json, os, shutil, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--chromium', default=shutil.which('chromium') or shutil.which('google-chrome'))
parser.add_argument('--output', type=Path, default=ROOT / 'tests/v0123/roads-results')
parser.add_argument('--screenshots', action='store_true')
args = parser.parse_args()
if not args.chromium:
    parser.error('Specify --chromium /path/to/chromium. On Linux provide a working DISPLAY (Xvfb is supported).')
args.output.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT))
from browser_helpers import offline_html
html = offline_html(ROOT / 'index.html')
# Test hooks only, never included in the release page.
js = Path(__file__).with_name('road-audit.js').read_text()
pos = html.rfind('\n})();\n</script>')
if pos < 0:
    raise RuntimeError('Main game closure not found; cannot safely inject tests.')
html = html[:pos] + '\n' + js + html[pos:]
shim = r"""
window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};
const store=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});
const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
Object.defineProperty(HTMLImageElement.prototype,'src',{get:desc.get,set(v){const k=String(v).replace(/^\.\//,'');if(window.__testAssets?.[k])v='data:image/png;base64,'+__testAssets[k];desc.set.call(this,v);}});
"""
html = html.replace('<head>', '<head><script>' + shim + '</script>', 1)
result = {'html_sha256': hashlib.sha256((ROOT / 'index.html').read_bytes()).hexdigest(),
          'mode': 'Native Chromium WebGL / SwiftShader; local-byte fixture; manual fixed-step simulation',
          'limitations': ['No physical-device or frame-rate claim', 'No HTTP/PWA lifecycle test', 'No public multiplayer connection test'],
          'checks': {}}

def compact(row):
    return {k: v for k, v in row.items() if k != 'trace'}

def save():
    (args.output / 'release-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')

with sync_playwright() as pw:
    errors = []
    browser = None
    page = None
    def fresh_page():
        # A new browser per bounded QA batch releases GPU/V8 geometry retained
        # by the instrumentation. This worker has a 4 GiB total memory budget.
        global browser, page
        if browser is not None:
            browser.close()
        browser = pw.chromium.launch(executable_path=args.chromium, headless=False,
                                    args=['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=1024'])
        page = browser.new_page(viewport={'width':1280,'height':800})
        page.on('pageerror', lambda error: (errors.append(str(error)), print('PAGE ERROR:', error, flush=True)))
        page.set_content(html,timeout=120000,wait_until='domcontentloaded')
        page.wait_for_function('window.__city012Ready',timeout=180000,polling=300)
        page.evaluate('__deliveryTest.freeze(true)')
    fresh_page()
    print('Native WebGL game ready', flush=True)
    result['browser'] = browser.version
    for name, expr in {
        'info': '__deliveryTest.city012.info()', 'audit': '__deliveryTest.city012.audit()',
        'connected': '__deliveryTest.city012.connected()', 'provenance': '__deliveryTest.qa122.provenance()',
        'seams': '__deliveryTest.qa122.seams()', 'rebake': '__deliveryTest.roads122.rebake()',
        'render': '__deliveryTest.qa122.renderState()'
    }.items():
        result[name] = page.evaluate(expr)
    for name in ['highways', 'streets', 'junctions', 'legacy']:
        rows = page.evaluate('__deliveryTest.qa122.' + name + '()')
        result[name + '_sweeps'] = rows
        bad = [r for r in rows if r['contacts'] or r['gaps'] or r['maxYError'] > .1]
        print(name, 'sweeps', len(rows), 'samples', sum(r['samples'] for r in rows), 'failures', len(bad), flush=True)
        result['checks'][name + '_physical_and_mesh_sweeps'] = not bad
        save()
    fresh_page()
    result['continuous_roads'] = []
    for rid in ['H1', 'H2', 'H3', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']:
        for reverse in [False, True]:
            r = compact(page.evaluate('([id,rev])=>__deliveryTest.qa122.driveRoad(id,rev)', [rid, reverse]))
            result['continuous_roads'].append(r)
            save()
            if len(result['continuous_roads']) % 4 == 0: fresh_page()
            print('Input-only drive', rid, reverse, r['completed'], 'hp', r['minHp'], flush=True)
    result['continuous_turns'] = []
    count = page.evaluate('__deliveryTest.qa122.turnCases().length')
    # Exhaustive geometry sweeps above cover all 704 movements. Continuous
    # input-only checks use 40 spread-out turns, separately reported, to keep
    # software-renderer test memory bounded. They are NOT all 704 drives.
    selected = sorted(set(round(i*(count-1)/39) for i in range(40)))
    result['continuous_turn_indices'] = selected
    for idx in selected:
        row = compact(page.evaluate('i=>__deliveryTest.qa122.driveCase(i)', idx))
        result['continuous_turns'].append(row)
        print('Input-only representative junction', idx, len(result['continuous_turns']), '/', len(selected), row['completed'], flush=True)
        save()
        if len(result['continuous_turns']) % 8 == 0: fresh_page()
    fresh_page()
    result['rethrows'] = []
    for wrong, order in [(101, 102), (104, 105), (113, 114), (114, 113), (117, 118), (118, 117)]:
        r = page.evaluate('([w,o])=>__deliveryTest.city012.regressionRethrow(w,o)', [wrong, order])
        result['rethrows'].append({'wrong': wrong, 'order': order, **r})
        print('Wrong-address -> recover -> rethrow', wrong, order, r.get('blocked'), flush=True)
    page.evaluate('__deliveryTest.suburban011.reset()')
    result['deliveries'] = [page.evaluate('n=>__deliveryTest.city012.delivery(n)', n) for n in range(101, 119)]
    result['extras'] = page.evaluate('__deliveryTest.city012.extras()')
    # Synthetic DOM pointer events exercise the real control event listeners;
    # these are NOT physical touchscreen tests.
    page.evaluate('__deliveryTest.qa122.prepare();__deliveryTest.city012.warp([0,.12,56],0)')
    page.dispatch_event('#gasBtn', 'pointerdown', {'pointerId': 11, 'pointerType': 'touch', 'isPrimary': True, 'button': 0})
    result['pointer_gas'] = page.evaluate('__deliveryTest.city012.drive(1.5,[])')
    page.dispatch_event('#gasBtn', 'pointercancel', {'pointerId': 11, 'pointerType': 'touch'})
    result['layouts'] = []
    for w, h in [(1280, 800), (390, 844), (844, 390)]:
        page.set_viewport_size({'width': w, 'height': h})
        page.wait_for_timeout(450)
        result['layouts'].append(page.evaluate('({w:innerWidth,h:innerHeight,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth})'))
    if args.screenshots:
        page.set_viewport_size({'width': 1280, 'height': 800})
        page.wait_for_timeout(450)
        page.evaluate('__deliveryTest.suburban011.reset();__deliveryTest.qa122.renderState()')
        for name, eye, at in [
            ('native-junction', [-311, 36, 147], [-368, 8, 112]),
            ('native-interchange', [-116, 49, -109], [-168, 8, -168]),
            ('native-ramp', [-281, 28, 187], [-275, 4, 112]),
        ]:
            page.evaluate('([e,a])=>__deliveryTest.city012.camera(e,a)', [eye, at])
            page.screenshot(path=str(args.output / (name + '.png')))
        page.evaluate('__deliveryTest.openCityMap()')
        page.screenshot(path=str(args.output / 'road-network-map.png'))
        page.evaluate('__deliveryTest.closeCityMap()')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(450)
        page.evaluate('__deliveryTest.city012.warp([106,.12,170.65],-Math.PI/2);__deliveryTest.qa122.renderState();__deliveryTest.city012.camera([86,14,192],[119,2,169])')
        page.screenshot(path=str(args.output / 'mobile-entry.png'))
    result['render_after_tests'] = page.evaluate('__deliveryTest.qa122.renderState()')
    result['errors'] = errors
    browser.close()

checks = result['checks']
checks.update({
    'native_webgl_no_gl_error': result['render']['glError'] == 0 and result['render_after_tests']['glError'] == 0,
    'no_runtime_errors': not result['errors'],
    'all_72_extension_models_loaded': result['info']['ready'] and result['info']['assets'] == 72,
    'native_only_road_meshes': result['provenance']['nativeTriangles'] == result['provenance']['drawnTriangles'] and result['provenance']['handmadeDeckSurfaces'] == 0 and result['provenance']['customHighwayChunks'] == 0 and not result['provenance']['missingAssets'],
    'native_junction_ports_continuous': not result['seams']['bad'],
    'rebake_preserves_all_surfaces': result['rebake']['before'] == result['rebake']['after'],
    'buildings_clear_of_roads_and_each_other': not result['audit']['overlaps'] and not result['audit']['roadConflicts'],
    'all_addresses_placed_with_portals': not result['audit']['unplaced'] and len(result['audit']['gates']) == 18 and all(g['count'] for g in result['audit']['gates']),
    'navigation_connected': result['connected']['reached'] == result['connected']['total'],
    'input_only_20_full_road_drives': len(result['continuous_roads']) == 20 and all(r['completed'] and r['minHp'] == 100 and r['geometryContacts'] == 0 and r['maxTrackError'] < 1 and r['maxHeightError'] < .1 for r in result['continuous_roads']),
    'input_only_40_representative_junctions': len(result['continuous_turns']) == len(selected) and all(r['completed'] and r['minHp'] == 100 and r['geometryContacts'] == 0 and r['maxTrackError'] < 1 and r['maxHeightError'] < .1 for r in result['continuous_turns']),
    'rejected_recovered_rethrows_6': all(r.get('rejected') and r.get('recovered') and r.get('cleared') and r.get('released') and r.get('blocked') for r in result['rethrows']),
    'deliveries_18': all(r['delivered'] for r in result['deliveries']),
    'responsive_dom_no_horizontal_overflow': all(r['doc'] <= r['w'] and r['body'] <= r['w'] for r in result['layouts']),
    'dom_pointer_throttle': result['pointer_gas']['speed'] > 5,
    'ground_highway_and_brick_throttle': all(result['extras'][k]['speed'] > 5 for k in ['street', 'elevated', 'brick']),
    'no_bridge_ground_ghost_collision': result['extras']['ghost']['hp'] == 100,
    'dynamic_props_impulse_and_sleep': result['extras']['prop']['awake'] and result['extras']['propAsleep'],
    'vehicle_mass_and_fragments': result['extras']['mass']['small']['vanSpeed'] > result['extras']['mass']['heavy']['vanSpeed'] and all(0 < d['fragments'] <= 3 for d in result['extras']['mass'].values()),
    'host_snapshot_data_roundtrip': result['extras']['sync']['match'] and result['extras']['sync']['trafficModels'] == 32 and result['extras']['sync']['highwayModels'] == 17,
    'deck_underside_blocks_parcel': result['extras']['underside']['blocked'],
})
result['summary'] = {'passed': sum(checks.values()), 'groups': len(checks),
                     'pose_samples': sum(r['samples'] for k in ['highways', 'streets', 'junctions', 'legacy'] for r in result[k + '_sweeps']),
                     'continuous_drives': len(result['continuous_roads']) + len(result['continuous_turns']),
                     'simulated_driving_seconds': sum(r['simulatedSeconds'] for r in result['continuous_roads'] + result['continuous_turns'])}
save()
print(json.dumps(result['summary'], ensure_ascii=False), flush=True)
if not all(checks.values()):
    raise SystemExit('FAILED: ' + ', '.join(k for k, v in checks.items() if not v))
print('All listed checks passed. Physical phones, hosting/PWA lifecycle and public multiplayer remain unverified.', flush=True)
