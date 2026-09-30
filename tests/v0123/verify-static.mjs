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
if(hash!==meta.html_sha256||meta.version!=='0.12.3')throw Error('Release metadata/hash mismatch');
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
for(const kind of ['commercial','cars','environment','trains','terrain']){
 const dir=path.join(root,'assets/kenney-'+kind);
 for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.glb'))){
  const b=fs.readFileSync(path.join(dir,name));if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)throw Error('Invalid GLB: '+name);
  const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  if((doc.buffers||[]).some(v=>v.uri)||(doc.images||[]).some(v=>v.uri&&!v.uri.includes('colormap.png')))throw Error('Unexpected external model dependency: '+name);
  assets++;
 }
 if(!fs.existsSync(path.join(dir,'License.txt'))||!fs.existsSync(path.join(dir,'Textures/colormap.png')))throw Error('Missing licence/palette');
}
if(assets!==72)throw Error('Missing selected model');
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

// The added terrain and rolling stock preserve the exact supplied GLB bytes.
for(const kind of ['trains','terrain']){
 const dir='assets/kenney-'+kind, manifest=JSON.parse(read(dir+'/manifest.json'));
 for(const row of manifest.models){const got=crypto.createHash('sha256').update(read(dir+'/'+row.file)).digest('hex');if(got!==row.sha256)throw Error('Source provenance mismatch: '+row.file);}
}
if(!html.includes('crash-delivery-mp0123-1'))throw Error('Wrong network protocol');
if(!html.includes('w123RailMap')||!html.includes('CD123Boot.finish()'))throw Error('World patch missing');
// Exercise cache strategy logic with real Response objects and an in-memory
// Cache API fixture. This is NOT a browser service-worker installation test.
const events={},stores=new Map();let online=true,skip=false,claimed=false,fetches=[];
function store(name){if(!stores.has(name))stores.set(name,new Map());return stores.get(name);}
const c2=vm.createContext({URL,Response,console,self:{registration:{scope},addEventListener:(n,f)=>events[n]=f,clients:{claim:async()=>{claimed=true}},skipWaiting:()=>{skip=true}},
 caches:{keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async name=>({addAll:async urls=>{for(const url of urls)store(name).set(url,new Response('cached:'+url,{headers:{'content-type':url.endsWith('.html')?'text/html':'application/octet-stream'}}));},match:async req=>store(name).get(typeof req==='string'?req:req.url)?.clone(),put:async(req,res)=>store(name).set(typeof req==='string'?req:req.url,res.clone())})},
 fetch:async(req,options)=>{fetches.push({url:typeof req==='string'?req:req.url,options});if(!online)throw Error('Offline');return new Response('fresh-index',{headers:{'content-type':'text/html'}});}});
vm.runInContext(read('sw.js').toString(),c2);
let task;events.install({waitUntil:p=>task=p});await task;
const current=vm.runInContext('CACHE',c2),prefix=vm.runInContext('PREFIX',c2);
stores.set(prefix+'old',new Map());stores.set('another-app-cache',new Map());
events.activate({waitUntil:p=>task=p});await task;
if(stores.has(prefix+'old')||!stores.has('another-app-cache')||!claimed)throw Error('Scope-safe activation cleanup failed');
events.message({data:{type:'ACTIVATE_UPDATE'}});if(!skip)throw Error('Explicit update activation failed');
function request(url,mode='navigate'){let response;events.fetch({request:{url,mode,method:'GET'},respondWith:p=>response=p});return response;}
let response=await request(scope);if(await response.text()!=='fresh-index'||fetches.at(-1).options.cache!=='no-store')throw Error('Network-first HTML failed');
online=false;response=await request(scope);if(await response.text()!=='fresh-index')throw Error('Offline HTML fallback failed');
response=await request(scope+'assets/kenney-trains/train-diesel-a.glb','cors');if(!response.ok)throw Error('Static train cache miss');
for(const url of ['https://api.example.test/turn-credentials',scope+'api/token',scope+'rooms'])if(request(url)!==undefined)throw Error('API interception');
const out={passed:true,version:meta.version,html_sha256:hash,selected_extension_models:assets,new_models:18,offline_files:precached.length,unchanged_road_files:Object.keys(nativeHashes).length,model_hashes:true,scope_safe_cache_cleanup:true,explicit_update_activation:true,network_first_html:true,offline_html_and_static_fallback:true,live_api_excluded:true,limitations:['In-memory Cache API fixture, not browser lifecycle','No real PWA install or iPhone standalone test']};
fs.writeFileSync(path.join(root,'tests/v0123/static-results.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
