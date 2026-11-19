/* c32: руководитель открывает сданный отчёт (только чтение) → «‹ Назад» → на главной плитки на месте, «Зарплата» и «График» открываются,
   отчёт остаётся только для чтения. Баг 19.11 (iPhone): класс «ro» на #app оставался после выхода из просмотра и скрывал все кнопки экранов.
   Мок ответов сервера. TAG=before — только показать состояние (без проверок). */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const head={id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,roles:['head']};
const BR=[{id:'marksa',title:'Маркса, 45'},{id:'70let',title:'70 лет Октября, 20'},{id:'pereleta',title:'Перелёта, 19'}];
const body=(n,a)=>{switch(n){
 case'ev_login_number':return{ok:true,token:'t',person:head};
 case'ev_day_status':return{ok:true,date:today,branches:BR.map(b=>({branch:b.id,title:b.title,submitted:true,version:1,submitted_at:today+'T09:20:00Z',open_flags:b.id==='pereleta'?1:0}))};
 case'ev_select_branch':return{ok:true,date:today};
 case'ev_context':return{ok:true,branches:BR,admins:[{id:16,name:'Фёдорова Т.В.'}],doctors:[{id:2,name:'Орлов И.П.',vm_id:1}],assistants:[],prev:null,current:{version:1,data:{},submitted_at:today+'T09:20:00Z'},articles:['Хозрасходы']};
 case'ev_cash_handover_context':return{ok:true,mode:'off'};
 case'ev_flags_pending':return{ok:true,pending:[{branch:'pereleta',date:today,code:'cash_diff',level:'yellow',title:'Расхождение кассы',version:1,accepted:false}],accepted:[],coverage:[]};
 case'ev_cash_on_hand':return{ok:false,error:'mock'};
 default:return{ok:true,rows:[],items:[],shifts:[],branches:[],people:[]}}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* видимые кнопки с действиями внутри #app (display:none не считаем) */
const vis=p=>p.evaluate(()=>({ro:document.getElementById('app').classList.contains('ro'),tiles:[...document.querySelectorAll('#app .ui2-role-tile')].filter(e=>getComputedStyle(e).display!=='none').length,tilesAll:document.querySelectorAll('#app .ui2-role-tile').length,view:S.view,roHead:!!S.roHead,text:document.getElementById('app').innerText.replace(/\s+/g,' ').slice(0,160)}));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of ['chromium','webkit']){
    const b=await pw[eng].launch();const c=await b.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/rest/v1/rpc/**',r=>{let a={};try{a=JSON.parse(r.request().postData()||'{}')}catch(e){}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop(),a))})});
    await p.goto(url);await wait(400);await p.locator('[data-act="loginstart"]').tap();for(const n of '123123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
    await p.locator('.ui2-home-screen').waitFor({timeout:8000});await wait(1200);
    let v=await vis(p);const tiles0=v.tiles;assert.ok(tiles0>=4,eng+': главная руководителя: плитки видны ('+JSON.stringify(v)+')');assert.equal(v.ro,false);
    // главная → «Отчёты сегодня» → филиал с замечанием → просмотр
    await p.locator('[data-act="repstatus"]').tap();await wait(300);await p.locator('.repbr[data-id="pereleta"]').tap();await p.locator('#rohead').waitFor({timeout:8000});await wait(400);
    v=await vis(p);assert.ok(v.roHead&&v.view==='form',eng+': открыт просмотр отчёта');
    const hidden=await p.evaluate(()=>{const bt=[...document.querySelectorAll('#app button[data-act]')].filter(e=>!['back','tochecks','flagdet'].includes(e.dataset.act));return bt.filter(e=>getComputedStyle(e).display!=='none').length});
    assert.equal(hidden,0,eng+': в просмотре кнопки действий скрыты (только чтение)');
    const accept=await p.evaluate(()=>[...document.querySelectorAll('[data-act="flagok"],[data-act="submit"],[data-act="send"]')].filter(e=>getComputedStyle(e).display!=='none').length);assert.equal(accept,0,eng+': «Принять/Отправить» в просмотре не видны');
    if(out)await p.screenshot({path:`${out}/${eng}-view-report-${process.env.TAG||'after'}.png`});
    await p.locator('button.pill[data-act="back"]').tap();await wait(700);
    v=await vis(p);console.log(eng,'после «‹ Назад»:',JSON.stringify(v));
    if(out)await p.screenshot({path:`${out}/${eng}-after-back-${process.env.TAG||'after'}.png`});
    if(process.env.TAG==='before'){await p.locator('[data-act="go"][data-v="ppl"], .nav [data-v="ppl"]').first().tap({timeout:3000}).catch(()=>{});await wait(600);console.log(eng,'Зарплата после назад:',JSON.stringify(await vis(p)));await b.close();continue}
    assert.equal(v.view,'branch',eng+': «Назад» ведёт на главную');assert.equal(v.ro,false,eng+': класс ro снят');assert.equal(v.roHead,false);assert.equal(v.tiles,tiles0,eng+': плитки на месте ('+v.tiles+' из '+tiles0+')');
    // вкладки нижней панели
    const nav=await p.evaluate(()=>[...document.querySelectorAll('#barwrap [data-act="go"]')].map(e=>e.dataset.v));
    assert.ok(nav.length>=3,eng+': нижняя панель есть '+nav);
    await p.locator('.ui2-role-tile[data-v="ppl"]').tap();await wait(900);let t=await p.evaluate(()=>({view:S.view,items:document.querySelectorAll('#app button[data-act],#app input').length,ro:document.getElementById('app').classList.contains('ro')}));
    assert.equal(t.view,'pay',eng+': «Зарплата» открылась');assert.equal(t.ro,false);
    await p.locator('#barwrap [data-act="go"][data-v="sched"]').first().tap();await wait(700);assert.equal(await p.evaluate(()=>S.view),'sched',eng+': «График» открылся');
    await p.locator('#barwrap [data-act="go"][data-v="branch"]').first().tap();await wait(700);v=await vis(p);assert.ok(v.view==='branch'&&v.tiles===tiles0,eng+': «Главная» — плитки на месте '+JSON.stringify(v));
    // повторно: отчёт → системная «назад» (popstate) → плитки на месте
    await p.locator('[data-act="repstatus"]').tap();await wait(300);await p.locator('.repbr[data-id="pereleta"]').tap();await p.locator('#rohead').waitFor({timeout:8000});await wait(300);
    await p.goBack();await wait(800);v=await vis(p);assert.ok(v.ro===false&&v.tiles===tiles0,eng+': после системной «назад» плитки на месте '+JSON.stringify(v));
    assert.deepEqual(errs,[],eng+': JS-ошибки '+errs.join('|'));
    await b.close();console.log(eng+' PASS');
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
