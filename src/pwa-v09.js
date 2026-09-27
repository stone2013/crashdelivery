/* Offline shell only. Credentials, signaling and room requests remain live. */
(()=>{
 if(!('serviceWorker' in navigator)||!window.isSecureContext||!/^https?:$/.test(location.protocol))return;
 let registration=null,accepting=false,deferred=null;
 const install=document.createElement('button');install.className='secondary';install.textContent='安装应用 / 离线使用';install.id='installPWA09';document.getElementById('helpBtn')?.after(install);
 install.onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;}else alert('iPhone：Safari 分享 → 添加到主屏幕。\nChrome / Edge：浏览器菜单 → 安装应用。\n需先联网打开并缓存成功，之后可离线单人游玩。多人仍需联网。');};
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;install.textContent='安装《暴力快递》 ↗';});
 const update=document.createElement('button');update.className='secondary hidden';update.textContent='新版已就绪 · 结束本局后更新';update.id='updatePWA09';install.after(update);
 update.onclick=()=>{if(confirm('刷新会结束当前游戏。现在更新？')){accepting=true;registration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});}};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(accepting)location.reload();});
 window.addEventListener('load',async()=>{try{registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});const show=()=>{if(registration.waiting&&navigator.serviceWorker.controller)update.classList.remove('hidden');};show();registration.addEventListener('updatefound',()=>{registration.installing?.addEventListener('statechange',show);});registration.update().catch(()=>{});}catch(e){console.warn('离线缓存尚未启用：',e.name);}});
})();
