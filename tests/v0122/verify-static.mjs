/** Dependency-free release checks. This script does NOT launch a browser. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=n=>fs.readFileSync(path.join(root,n));
const meta=JSON.parse(read('VERSION.json'));
const hash=crypto.createHash('sha256').update(read('index.html')).digest('hex');
if(hash!==meta.html_sha256||meta.version!=='0.12.2')throw Error('Release metadata/hash mismatch');
const listeners={};let precached=[];
const context=vm.createContext({URL,Response,console,self:{registration:{scope:'https://example.test/crashdelivery/'},addEventListener:(n,f)=>listeners[n]=f,clients:{claim:async()=>{}},skipWaiting:()=>{}},caches:{open:async()=>({addAll:async urls=>{precached=urls;}})}});
vm.runInContext(read('sw.js').toString(),context);
let install;listeners.install({waitUntil:p=>install=p});await install;
const scope='https://example.test/crashdelivery/';
for(const url of precached){if(!url.startsWith(scope))throw Error('Unexpected external cache resource');const rel=decodeURIComponent(url.slice(scope.length));if(!fs.existsSync(path.join(root,rel)))throw Error('Missing offline resource: '+rel);}
if(precached.length!==meta.offline_resources+1)throw Error('Offline resource count mismatch');
if(!vm.runInContext(`CACHE.endsWith('${hash.slice(0,16)}')`,context))throw Error('Stale SW cache key');
for(const url of ['https://api.example.test/turn-credentials','https://example.test/rooms','https://example.test/crashdelivery/api/token'])if(!vm.runInContext(`liveOnly(new URL(${JSON.stringify(url)}))`,context))throw Error('Live network endpoint would be cached');
let assets=0;
for(const kind of ['commercial','cars','environment']){
 const dir=path.join(root,'assets/kenney-'+kind);
 for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.glb'))){
  const b=fs.readFileSync(path.join(dir,name));if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('Invalid GLB: '+name);
  const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  if((doc.buffers||[]).some(v=>v.uri)||(doc.images||[]).some(v=>v.uri&&!v.uri.includes('colormap.png')))throw Error('Unexpected external model dependency: '+name);
  assets++;
 }
 if(!fs.existsSync(path.join(dir,'License.txt'))||!fs.existsSync(path.join(dir,'Textures/colormap.png')))throw Error('Missing licence/palette');
}
if(assets!==54)throw Error('Missing selected model');
console.log(JSON.stringify({passed:true,version:meta.version,html_sha256:hash,new_models:assets,offline_files:precached.length,api_not_cached:true},null,2));
// Native road source files must remain byte-identical to the supplied asset pack.
const nativeHashes = JSON.parse(read('tests/v0122/road-assets.sha256.json'));
for (const [name, expected] of Object.entries(nativeHashes)) {
  const actual = crypto.createHash('sha256').update(read(name)).digest('hex');
  if (actual !== expected) throw Error('Native asset was changed: ' + name);
}
const html = read('index.html').toString();
if (/const ROAD09_GLB_PACK=/.test(html) || /const ROAD09_ATLAS=/.test(html)) throw Error('Retired embedded road copy remains');
if (html.includes('city012Bake(b,\'highway\')') || html.includes("b.box(.11,.014,len+.05")) throw Error('Handmade highway render code remains');
if (!html.includes('road122Normal') || !html.includes('assets/kenney-roads/')) throw Error('Native road planner not present');
console.log(JSON.stringify({unchanged_native_road_files: Object.keys(nativeHashes).length, retired_embedded_models: true, native_planner_present: true}));
