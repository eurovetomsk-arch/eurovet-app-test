/* c26: в форме «Вечерний отчёт» (нет нижней панели) есть видимый выход: кнопка «‹ На главную» и в шапке «‹ Назад»; системная «назад» (history.back) ведёт на главную, черновик сохраняется. Мок ответов сервера. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const adm={id:301,full_name:'Тестова Е. Н.',short_name:'Тестова Е.Н.',name:'Тестова Е.Н.',admin:true,roles:['admin'],branch:'70let'};
const ctxOk={ok:true,branch:'70let',date:today,admins:[{id:301,name:'Тестова Е.Н.'}],staff:[],prev:null,current:null,lists:{},articles:[],doctors:[],assistants:[]};
const body=n=>({ev_login_number:{ok:true,token:'t',person:adm},ev_select_branch:{ok:true,date:today,branch:'70let'},ev_context:ctxOk,ev_cash_handover_context:{ok:true,mode:'off'},ev_whos_where:{ok:true,rows:[{date:today,branch:'70let',person_id:301,mine:true,short_name:'Тестова Е.Н.',start:'09:00',end:'21:00'}]},ev_day_status:{ok:true,branches:[{branch:'70let',submitted:false,open_flags:0}]}}[n]||{ok:true,rows:[],items:[]});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of ['chromium','webkit']){
    const b=await pw[eng].launch();const c=await b.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/rest/v1/rpc/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop()))}));
    await p.goto(url);await wait(400);await p.locator('[data-act="loginstart"]').tap();for(const n of '301123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
    await p.locator('.ui2-home-screen').waitFor();await wait(800);
    const open=async()=>{await p.locator('.ui2-role-tile:has-text("Вечерний отчёт")').tap();await wait(700);await p.locator('.ov [data-act="branch"]').first().tap();await p.waitForFunction(()=>S.view==='form',null,{timeout:8000});await wait(800)};
    await open();
    assert.equal(await p.locator('.ui2-bottom-nav').count(),0,eng+': в форме нет нижней панели (как в отчёте Герман)');
    const t=await p.evaluate(()=>({btn:[...document.querySelectorAll('#app [data-act="back"]')].map(b=>b.textContent.trim()),pill:(document.querySelector('header .pill[data-act="back"]')||{}).textContent}));
    assert.ok(t.btn.some(x=>/На главную/.test(x)),eng+': кнопка «На главную» в форме '+JSON.stringify(t));assert.match(t.pill||'',/Назад/,eng+': в шапке «Назад»');
    if(out)await p.screenshot({path:`${out}/${eng}-form-375.png`});
    // черновик: вносим значение и выходим кнопкой
    await p.evaluate(()=>{S.form.clinic=S.form.clinic||{};document.querySelector('#app input[data-p]').value='123';document.querySelector('#app input[data-p]').dispatchEvent(new Event('input',{bubbles:true}))});await wait(150);
    await p.locator('#app [data-act="back"]').first().tap();await wait(600);
    assert.equal(await p.evaluate(()=>S.view),'branch',eng+': кнопка ведёт на главную');
    assert.ok(await p.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('ev_draft2:'))),eng+': черновик сохранён при выходе');
    // системная «назад» из формы
    await open();await p.evaluate(()=>history.back());await wait(900);
    assert.equal(await p.evaluate(()=>S.view),'branch',eng+': системная «назад» из формы ведёт на главную, а не закрывает приложение');
    assert.deepEqual(errs,[],eng+': JS-ошибки '+errs.join('|'));
    await b.close();console.log(eng+' PASS');
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
