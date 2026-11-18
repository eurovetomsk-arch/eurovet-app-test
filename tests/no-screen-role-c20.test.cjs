/* c20 (отчёт 3724): роль без экрана (аутсорс: сервер отдаёт roles=[]) — после входа приложение не строится, сессия закрывается; приветствие из 2 слов — без имени. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const person={id:36,full_name:'Муравьев Сергей',short_name:'Муравьев С.',roles:[]};
const calls=[];
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  const b=await pw.chromium.launch();const c=await b.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/rest/v1/rpc/**',async r=>{const n=r.request().url().split('/').pop();calls.push(n);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(n==='ev_login_number'?{ok:true,token:'t',person}:{ok:true,rows:[],items:[],shifts:[],branches:[]})})});
  await p.goto(url);await wait(300);await p.locator('[data-act="loginstart"]').tap();for(const n of '123123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
  await wait(1500);
  const t=await p.evaluate(()=>document.body.innerText);
  assert.match(t,/не предусмотрен/,'нет сообщения «экран не предусмотрен»');
  assert.equal(await p.locator('.ui2-home-screen, nav.nv').count(),0,'главный экран и меню строиться не должны');
  assert.ok(calls.includes('ev_logout'),'серверная сессия должна закрываться');
  assert.doesNotMatch(t,/Доброе утро|Добрый день|Добрый вечер|Здравствуйте, Муравьев/);
  assert.deepEqual(errs,[]);
  // приветствие из двух слов — без имени
  const g=await p.evaluate(()=>[stageGreetingName({full_name:'Муравьев Сергей',short_name:'Муравьев С.'}),stageGreetingName({full_name:'Иванова Мария Петровна',short_name:'Иванова М.П.'})]);
  assert.deepEqual(g,['','Мария Петровна']);
  console.log('no-screen-role c20: OK');await b.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
