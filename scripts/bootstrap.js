'use strict';
/* ====== Запуск ====== */
(async()=>{
  idleCheck();
  if(S.token&&S.person)setTimeout(birthdayCheck,600);
  if(S.token&&S.person)S.view=homeView();
  if(S.view==='cc')showCC();else if(S.view==='work')showWork();else render();
  if('serviceWorker' in navigator){for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();}
  if('caches' in window){for(const k of await caches.keys())if(k.startsWith('ev-'))await caches.delete(k);}
  if(S.view==='login'){await loadLoginList();render()}
  else if(S.queue.length)flush();
  setTimeout(()=>checkUpdate(true),2500);
})();
