// Policy-level SW tests in a mock runtime. No claim of native installation or network lifecycle.
import fs from 'node:fs'; import vm from 'node:vm';
const root = new URL('../', import.meta.url);const source=fs.readFileSync(new URL('sw.js',root),'utf8');
const handlers={},checks=[],deleted=[],store=new Map(),cache={addAll:async a=>{cache.list=a;},put:async(k,v)=>store.set(k,v),match:async k=>store.get(typeof k==='string'?k:k.url)};
let network=async()=>new Response('<html>new</html>',{headers:{'content-type':'text/html'}});
const ctx={URL,Response,console,self:{registration:{scope:'https://example.test/game/'},addEventListener:(t,f)=>handlers[t]=f,skipWaiting:()=>{ctx.skipped=true;},clients:{claim:async()=>{ctx.claimed=true;}}},caches:{open:async()=>cache,keys:async()=>['unrelated-cache','crashdelivery-pwa::/other/::old','crashdelivery-pwa::/game/::old'],delete:async n=>deleted.push(n)},fetch:(...a)=>network(...a)};
vm.createContext(ctx);vm.runInContext(source,ctx);
function ck(test,passed,detail=null){checks.push({test,passed:!!passed,detail});console.log(passed?'PASS':'FAIL',test);}
async function lifecycle(name,data){let p;handlers[name]({data,waitUntil:x=>p=x});await p;}
await lifecycle('install');ck('No forced skipWaiting on install',!ctx.skipped);ck('Shell contains entry',cache.list.includes('https://example.test/game/index.html'));ck('All 13 GLBs pre-cached',cache.list.filter(x=>x.endsWith('.glb')).length===13);ck('RGBA atlas pre-cached',cache.list.some(x=>x.endsWith('variation-a.png')));
await lifecycle('activate');ck('Only own old cache deleted',deleted.length===1&&deleted[0].endsWith('/game/::old'));ck('Activation claims clients',ctx.claimed);
handlers.message({data:{type:'ACTIVATE_UPDATE'}});ck('Update requires explicit message',ctx.skipped);
async function fetchTest(path,method='GET',mode='cors'){let p;handlers.fetch({request:{url:'https://example.test/game/'+path,method,mode},respondWith:x=>p=x});return p?await p:null;}
for(const path of ['turn-credentials','rooms','rooms/123','api/private'])ck('Bypass real-time '+path,await fetchTest(path)===null);
let routed=false;handlers.fetch({request:{url:'https://api.feelpal.app/turn-credentials',method:'GET',mode:'cors'},respondWith:()=>routed=true});ck('Bypass cross-origin credentials',!routed);
ck('Bypass writes',await fetchTest('index.html','POST')===null);ck('Do not cache arbitrary files',await fetchTest('private.txt')===null);
let options;network=async (req,o)=>{options=o;return new Response('<html>fresh</html>',{headers:{'content-type':'text/html'}})};let r=await fetchTest('index.html','GET','navigate');ck('Navigation network-first no-store',options?.cache==='no-store'&&(await r.text()).includes('fresh'));
network=async()=>{throw Error('offline');};r=await fetchTest('index.html','GET','navigate');ck('Offline falls back to cached entry',(await r.text()).includes('fresh'));
store.clear();r=await fetchTest('index.html','GET','navigate');ck('Missing offline entry returns meaningful 503',r.status===503&&(await r.text()).includes('联网'));
ck('Manifest correct visible version',JSON.parse(fs.readFileSync(new URL('manifest.webmanifest',root),'utf8')).name.includes('V0.10.2'));
fs.writeFileSync(new URL('tests/V0102_PWA_RESULTS.json',root),JSON.stringify({checks,passed:checks.filter(x=>x.passed).length,total:checks.length},null,2));console.log('SUMMARY',checks.filter(x=>x.passed).length,'/',checks.length);if(checks.some(x=>!x.passed))process.exitCode=1;
