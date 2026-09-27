/** Contract tests of the actual service worker using web-standard Request/Response in Node.
 * This is NOT a browser installation / Safari offline restart test.
 */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),results=[];
function check(name,test){assert.ok(test,name);results.push({test:name,passed:true});console.log('PASS',name);}
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.webmanifest',root),'utf8'));
check('Manifest has relative scope and start URL',manifest.scope==='./'&&manifest.start_url==='./index.html');
for(const icon of manifest.icons)check('PNG icon exists: '+icon.sizes,fs.existsSync(new URL(icon.src,root)));
const stores=new Map(),listeners={};let fetched=[],fail=false,status=200,skip=0,claimed=0;
const base='https://example.test/crashdelivery/';
const normalized=k=>typeof k==='string'?new URL(k,base).href:k.url;
const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return{async addAll(urls){for(const url of urls)store.set(normalized(url),new Response('cached-shell',{headers:{'Content-Type':'text/html'}}));},async match(req){return store.get(normalized(req))?.clone();},async put(req,value){store.set(normalized(req),value.clone());}};},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
const self={registration:{scope:base},clients:{async claim(){claimed++;}},skipWaiting(){skip++;},addEventListener(name,cb){listeners[name]=cb;}};
const context={self,caches,URL,Request,Response,fetch:async(request,options)=>{fetched.push({url:normalized(request),options});if(fail)throw Error('offline');return new Response(status===200?'online-game':'error',{status,headers:{'Content-Type':'text/html'}});}};
vm.runInNewContext(fs.readFileSync(new URL('sw.js',root),'utf8'),context);
let waiting;listeners.install({waitUntil:p=>waiting=p});await waiting;
check('Shell installation does not activate during a live game',skip===0);
const name=[...stores.keys()][0];check('Cache includes full game, manifest and icons only',stores.get(name).size===5);
stores.set('unrelated-app-cache',new Map());stores.set('crashdelivery-pwa::/elsewhere/::old',new Map());stores.set('crashdelivery-pwa::/crashdelivery/::old',new Map());listeners.activate({waitUntil:p=>waiting=p});await waiting;
check('Activation preserves unrelated app caches',stores.has('unrelated-app-cache')&&stores.has('crashdelivery-pwa::/elsewhere/::old'));
check('Activation deletes only own outdated scope caches',!stores.has('crashdelivery-pwa::/crashdelivery/::old')&&claimed===1);
function dispatch(url,mode='navigate',method='GET'){let response;listeners.fetch({request:{url,mode,method},respondWith:r=>response=r});return response;}
let response=await dispatch(base+'index.html');check('Game HTML uses network first',(await response.text())==='online-game'&&fetched.at(-1).options.cache==='no-store');
fail=true;response=await dispatch(base+'?room=246810');check('Offline navigation returns cached game not a broken invite URL',(await response.text())==='online-game');fail=false;
status=500;response=await dispatch(base);check('Server error never overwrites healthy offline HTML',(await response.text())==='online-game');status=200;
check('Cross-origin TURN credentials bypass cache',dispatch('https://api.feelpal.app/turn-credentials','cors')===undefined);
check('Same-origin room APIs bypass cache',dispatch(base+'rooms','cors')===undefined);
check('POST requests bypass cache',dispatch(base+'rooms','cors','POST')===undefined);
check('Unlisted resources are not opportunistically cached',dispatch(base+'arbitrary-secret.json','cors')===undefined);
check('Unknown navigation does not cache false game responses',dispatch(base+'admin')===undefined);
listeners.message({data:{type:'ACTIVATE_UPDATE'}});check('Waiting update activates only on explicit message',skip===1);
fs.writeFileSync(new URL('tests/pwa_results.json',root),JSON.stringify(results,null,2));console.log('TOTAL',results.length);
