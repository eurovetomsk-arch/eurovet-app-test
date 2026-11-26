/* c21: работа без интернета (слово Михаила 18.11). Chromium и WebKit.
   Сеть имитируется двояко: адресная — сервер файлов обрывает соединения (видит и service worker), RPC Supabase — route.abort.
   Проверяем: sw регистрируется и кэширует оболочку; без сети приложение открывается; отчёт и приёмка кассы без сети идут в очередь на устройстве;
   очередь переживает закрытие вкладки; после возвращения сети и входа отправка один раз (без дубля). Пределы описаны в OFFLINE.md. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const admin={id:16,full_name:'Фёдорова Татьяна Владимировна',short_name:'Фёдорова Т.В.',name:'Фёдорова Т.В.',admin:true,roles:['admin']};
const BR=[{id:'marksa',title:'Маркса, 45'},{id:'pereleta',title:'Перелёта, 19'},{id:'70let',title:'70 лет Октября, 20'}];
const net={offline:false,slow:0};const rpcLog=[];
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.jpg':'image/jpeg','.pdf':'application/pdf'};
let origin='';let oldSw=null;
function handle(q,s){
  if(net.offline){q.socket.destroy();return}
  if(net.slow&&q.method==='GET'&&!q._d){q._d=1;setTimeout(()=>{if(net.offline)q.socket.destroy();else handle(q,s)},net.slow);return}
  if(q.method==='POST'&&q.url.startsWith('/mock/rest/v1/rpc/')){
    const n=q.url.split('/').pop();let body='';q.on('data',d=>body+=d);q.on('end',()=>{let a={};try{a=JSON.parse(body||'{}')}catch(e){}
      rpcLog.push(n+(n==='ev_submit'?' uid='+a.p_client_uid:'')+(n==='ev_cash_handover_accept'?' a='+a.p_actual:''));
      s.writeHead(200,{'content-type':'application/json'});s.end(JSON.stringify(rpcBody(n,a)))});return}
  const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404).end();return}
  let data=fs.readFileSync(f);
  if(rel==='sw.js'&&oldSw)data=oldSw;
  if(rel==='scripts/common.js')data=Buffer.from(data.toString('utf8').replace(/url:'https:\/\/[^']+supabase\.co'/,"url:'"+origin+"/mock'"));
  s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});s.end(data)}
const server=http.createServer(handle);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function rpcBody(name,a){
  switch(name){
    case'ev_login_number':return{ok:true,token:'tok-'+Date.now(),person:admin};
    case'ev_select_branch':return{ok:true,date:today};
    case'ev_context':return{ok:true,branches:BR,admins:[{id:16,name:'Фёдорова Т.В.'}],doctors:[{id:2,name:'Орлов И.П.',vm_id:1}],assistants:[{id:11,role:'assistant_clinical',name:'Семёнова А.Р.'}],prev:{closing:1000,date:'2026-11-16',version:1},current:null,articles:['Хозрасходы']};
    case'ev_cash_handover_context':return{ok:true,mode:'on',can_accept:true,can_correct:false,expected:1000,source:{report_date:today,fingerprint:'fp1',report_version:1},current:null};
    case'ev_cash_handover_accept':return{ok:true,status:'accepted'};
    case'ev_submit':return{ok:true,version:1};
    case'ev_day_status':return{ok:true,date:today,branches:[]};
    case'ev_sched_get':case'ev_schedule':return{ok:true,rows:[]};
    default:return{ok:true,rows:[],items:[],shifts:[],branches:[]};
  }
}
async function newCtx(browser){return browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,serviceWorkers:'allow'})}
/* setOffline браузера (события online/offline) — только Chromium: в WebKit он ломает открытие страницы из кэша service worker ещё до sw; там сеть рвёт сервер файлов */
async function goOffline(c){net.offline=true;if(c.browser().browserType().name()==='chromium')await c.setOffline(true)}
async function goOnline(c){net.offline=false;if(c.browser().browserType().name()==='chromium')await c.setOffline(false)}
async function login(p){
  await p.locator('[data-act="loginstart"]').tap();const pinOnly1=await p.evaluate(()=>S.loginStep==='pin'); /* c28/c31: запомненный номер подставлен по «Войти» */for(const n of (pinOnly1?'123456':'123123456'))await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
  await p.locator('.ui2-home-screen').waitFor({timeout:8000}).catch(async e=>{console.log('LOGIN-DEBUG',await p.evaluate(async()=>{try{const r=await fetch(CFG.url+'/rest/v1/rpc/ev_x',{method:'POST',body:'{}'});return CFG.url+' '+r.status}catch(e){return CFG.url+' ERR '+e}}),rpcLog.slice(-4),(await p.evaluate(()=>document.body.innerText)).slice(0,200));throw e});await wait(500);
}
async function until(p,fn,ms){const t=Date.now();while(Date.now()-t<(ms||20000)){if(await p.evaluate(fn).catch(()=>false))return;await wait(300)}throw new Error('таймаут: '+fn)}
const sent=()=>rpcLog.filter(x=>x.startsWith('ev_submit')).length;
(async()=>{
  /* 1. список файлов sw.js = файлы проекта */
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  const lists=(sw.match(/const (SHELL|OPTIONAL)=(\[[\s\S]*?\]);/g)||[]).map(x=>JSON.parse(x.replace(/^const \w+=/,'').replace(/;$/,'')));
  const listed=new Set(lists.flat());assert.equal(lists.length,2,'sw.js: SHELL и OPTIONAL');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const need=new Set(['./','index.html','config.js','manifest.webmanifest','xlsx.core.min.js','icon-v3.svg','mark.svg','icon-v3-180.png','icon-v3-192.png','icon-v3-512.png']);
  for(const m of html.matchAll(/<script src="([^"]+)"/g))need.add(m[1]);
  for(const m of html.matchAll(/<link[^>]+href="([^"#]+)"/g))if(!/^https?:/.test(m[1]))need.add(m[1]);
  for(const f of fs.readdirSync(path.join(root,'scripts')))if(f.endsWith('.js'))need.add('scripts/'+f);
  for(const f of fs.readdirSync(path.join(root,'fonts')))need.add('fonts/'+f);
  for(const f of fs.readdirSync(path.join(root,'icons')))if(f.endsWith('.png'))need.add('icons/'+f);
  for(const f of fs.readdirSync(path.join(root,'help')))if(f.endsWith('.jpg'))need.add('help/'+f);
  for(const f of need)assert.ok(listed.has(f),'sw.js не кэширует '+f);
  for(const f of listed)if(f!=='./')assert.ok(fs.existsSync(path.join(root,f)),'sw.js: файла нет '+f);
  const boot=fs.readFileSync(path.join(root,'scripts/bootstrap.js'),'utf8');
  assert.match(boot,/serviceWorker\.register\('sw\.js'\)/);assert.match(boot,/navigator\.webdriver/);assert.doesNotMatch(boot,/unregister\(/);assert.doesNotMatch(boot,/caches\.delete/);

  await new Promise(o=>server.listen(0,'127.0.0.1',o));origin='http://127.0.0.1:'+server.address().port;const url=origin+'/?sw=1';
  for(const eng of (process.env.ENGINES||'chromium,webkit').split(',')){
    net.offline=false;rpcLog.length=0;
    const b=await pw[eng].launch();const c=await newCtx(b);const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    /* 1б. переход с 1.92: клиент со старым sw.js (V=ev-shell-v92b) сам получает новый sw.js по тому же адресу, без повторной установки */
    {const oldFile=path.resolve(root,'..','eurovet-app','sw.js');
     if(fs.existsSync(oldFile)){
      oldSw=fs.readFileSync(oldFile);const cm=await b.newContext({serviceWorkers:'allow'});const pm=await cm.newPage();
      await pm.goto(url);await until(pm,async()=>(await caches.keys()).some(k=>k.startsWith('ev-shell-')));
      const before=await pm.evaluate(async()=>(await caches.keys()).join(','));assert.match(before,/ev-shell-v92b/,eng+': старый sw установлен');
      oldSw=null;await pm.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
      await until(pm,async()=>{const k=await caches.keys();return k.includes('ev2-shell-2')&&!k.some(x=>x.startsWith('ev-shell-'))});
      console.log(eng,'переход 1.92→2.0: старый sw заменён новым, старый кэш удалён');await cm.close();
     }else console.log(eng,'старого sw.js 1.92 нет рядом — переход не проверен')}
    /* 2. онлайн: sw ставится и кэширует оболочку */
    await p.goto(url);
    await p.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller||false,null,{timeout:15000}).catch(()=>{});
    await p.evaluate(()=>navigator.serviceWorker.ready);
    await until(p,async()=>{const ks=await caches.keys();if(!ks.includes('ev2-shell-2'))return false;const c=await caches.open('ev2-shell-2');return (await c.keys()).length>=39},30000);
    await p.reload();await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000});
    console.log(eng,'sw: оболочка в кэше');
    /* 3. вошли, открыли филиал онлайн (список сохраняется «в запас»), сеть пропала */
    await login(p);
    await p.evaluate(()=>openBranch('marksa'));await p.waitForFunction(()=>S.view==='form'&&S.ctx,null,{timeout:8000});await wait(800);
    assert.ok(await p.locator('#ho-actual').count()===1,eng+': приёмка кассы онлайн показана');
    await goOffline(c);await wait(300);
    /* 3a. касса без сети: приём уходит в очередь */
    await p.locator('#ho-actual').fill('1000');await p.locator('[data-act="hoaccept"]').tap();await wait(800);
    assert.equal(await p.evaluate(()=>S.handoverQueue.length),1,eng+': приёмка кассы в очереди на устройстве');
    assert.equal(rpcLog.filter(x=>x.startsWith('ev_cash_handover_accept')).length,0,eng+': приёмка без сети не ушла');
    /* 3b. отчёт без сети */
    await p.evaluate(()=>{const f=S.form;f.total='1000';f.cash='500';f.cashless='500';f.open='1000';f.close='500';f.ph_val='100';f.ph_cash='100';f.ph_cashless='0';f.no_assistant=true;f.diff_reason='тест без сети';f.doctors={2:{val:'1000'}};f.admins={16:{left:'',came:''}}});
    await p.evaluate(()=>submit());await wait(1500);
    let st=await p.evaluate(()=>({q:S.queue.length,v:S.view,txt:document.getElementById('app').innerText,ov:document.getElementById('ovwrap').innerText}));
    if(st.q===0){console.log(eng,'ПОДСКАЗКА: отчёт не встал в очередь:',st.txt.slice(0,300),st.ov.slice(0,200))}
    assert.equal(st.q,1,eng+': отчёт в очереди');assert.match(st.txt,/Пока не отправлен|сохранён на устройстве/,eng+': статус «не отправлен»');assert.match(st.txt,/Отправится сам/,eng+': «отправится сам»');
    assert.equal(sent(),0,eng+': без сети отчёт не ушёл');
    if(out)await p.screenshot({path:out+'/'+eng+'-1-offline-not-sent.png'});
    const qJson=await p.evaluate(()=>localStorage.getItem('ev_queue'));assert.ok(qJson&&qJson.length>50,eng+': очередь записана в localStorage');
    /* 4. вкладку закрыли (приложение закрыто), сети всё ещё нет: страница открывается из кэша, очередь на месте */
    await p.close();const p2=await c.newPage();p2.on('pageerror',e=>errs.push(e.message));
    await p2.goto(url);await wait(1500);
    const off=await p2.evaluate(()=>({txt:document.body.innerText,q:S.queue.length,hq:S.handoverQueue.length,view:S.view}));
    assert.equal(off.view,'login',eng+': без сети страница открылась (экран входа)');assert.equal(off.q,1,eng+': очередь отчётов цела после закрытия');assert.equal(off.hq,1,eng+': очередь кассы цела после закрытия');
    assert.match(off.txt,/ждёт отправки: отчётов 1, приёмок кассы 1/,eng+': на экране входа сказано, что данные сохранены');
    if(out)await p2.screenshot({path:out+'/'+eng+'-2-offline-login.png'});
    /* c28: номер запомнен на устройстве — после повторного открытия сразу экран PIN */await p2.locator('[data-act="loginstart"]').tap();const pinOnly=await p2.evaluate(()=>S.loginStep==='pin');for(const n of (pinOnly?'123456':'123123456'))await p2.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();await wait(800);
    assert.match(await p2.evaluate(()=>document.body.innerText),/Нет связи/,eng+': вход без сети — понятное сообщение');
    /* 5. сеть вернулась, вход: отправляется один раз, без дубля */
    await goOnline(c);await wait(300);
    await p2.reload();await wait(1200);
    await login(p2);
    await p2.waitForFunction(()=>S.queue.length===0&&S.handoverQueue.length===0,null,{timeout:25000});
    await wait(9500); /* ещё один круг автоповтора (8 с) — дубля быть не должно */
    assert.equal(sent(),1,eng+': отчёт отправлен ровно один раз, ev_submit='+sent());
    const acc=rpcLog.filter(x=>x.startsWith('ev_cash_handover_accept')).length;assert.equal(acc,1,eng+': приёмка кассы отправлена один раз, ='+acc);
    assert.equal(await p2.evaluate(()=>localStorage.getItem('ev_queue')),'[]',eng+': очередь пуста');
    /* 6. очень медленная сеть (ответ через 7 с): открывается сохранённая копия, без ошибки и без ожидания по 4 с на каждый файл */
    if(eng==='chromium'){ /* в WebKit Playwright этот сценарий (ответ сервера через 7 с) не открывает страницу даже с копией: проверено вручную нельзя, в отчёте помечено «не покрыто» */
    await p2.close();net.slow=7000;const p3=await c.newPage();const t0=Date.now();await p3.goto(url,{waitUntil:'domcontentloaded',timeout:20000});const dt=Date.now()-t0;
    assert.ok(dt<6500,eng+': копия показана быстрее 6,5 с (не ждёт медленную сеть по 4 с на каждый файл), было '+dt+' мс');console.log(eng,'медленная сеть: страница из копии за',dt,'мс');assert.ok(/Войти|Введите PIN/.test(await p3.evaluate(()=>document.body.innerText)),eng+': страница из копии открылась (экран входа или PIN при запомненном номере)');net.slow=0;}
    assert.deepEqual(errs,[],eng+': ошибки JS '+errs.join('|'));
    console.log(eng,'PASS');await b.close();
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
