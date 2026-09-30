/* Actual parsed-resource and initialization progress; never a elapsed-time percent. */
(()=>{
 const B=window.CD123Boot={done:new Set(),total:140,ready:false,error:'',stage:'读取原生道路和建筑',serial:0,last:performance.now(),history:[]};
 B.paint=()=>{const root=document.getElementById('boot123');if(!root)return;const n=B.ready?100:Math.min(99,Math.floor(B.done.size/B.total*100));document.getElementById('boot123bar').value=n;document.getElementById('boot123pct').textContent=n+'%';document.getElementById('boot123label').textContent=B.error?'加载失败 · '+B.error:B.ready?'城市已就绪 · 开始派送':B.stage;document.getElementById('boot123count').textContent=B.error?'请检查更新包中的 assets 是否一并上传；可重新加载。':B.done.size+' / '+B.total+' 项 · 模型解析与场景初始化';document.getElementById('boot123retry').hidden=!B.error;root.dataset.state=B.error?'error':B.ready?'ready':'loading';root.setAttribute('aria-busy',String(!B.ready&&!B.error));for(const id of ['startBtn','roadStart09','hostBtn','joinBtn']){const el=document.getElementById(id);if(el)el.disabled=!B.ready||!!B.error;}};
 B.mark=(key,label)=>{if(!B.done.has(key)){B.done.add(key);B.last=performance.now();if(label)B.stage=label;B.history.push({n:B.done.size,label,t:B.last});B.paint();}};
 B.fail=e=>{if(B.ready)return;B.error=String(e?.message||e).slice(0,180);B.paint();};
 B.finish=()=>{B.mark('init:ready','城市已就绪');if(B.done.size!==B.total){B.fail('资源计数不一致 '+B.done.size+'/'+B.total);return;}B.ready=true;B.paint();};
 document.addEventListener('DOMContentLoaded',()=>{document.getElementById('boot123retry')?.addEventListener('click',()=>location.reload());B.paint();});
 // Guard every entry point even if a legacy loader enables its button early.
 document.addEventListener('click',e=>{if(!B.ready&&e.target.closest?.('#startBtn,#roadStart09,#hostBtn,#joinBtn')){e.preventDefault();e.stopImmediatePropagation();B.paint();}},true);
 const timer=setInterval(()=>{if(B.ready||B.error){clearInterval(timer);return;}if(performance.now()-B.last>60000)B.fail('资源读取超时，请检查网络后重新加载');},3000);
 window.addEventListener('error',e=>{if(!B.ready&&e.message)B.fail(e.message);});window.addEventListener('unhandledrejection',e=>{if(!B.ready)B.fail(e.reason||'初始化失败');});
})();
