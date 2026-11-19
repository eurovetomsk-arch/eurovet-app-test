/* c23: на Android Chrome жест пальцем должен прокручивать страницу (причина «замёрзшего» экрана: overscroll-behavior-y:none + overflow-x:hidden у body).
   Эмуляция Pixel 7, настоящий touch-жест через CDP (не колесо). Мок ответов сервера, вход руководителя мок. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const head={id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,roles:['head']};
const mk=(b,d)=>({branch:b,date:d,code:'many_edits',level:'yellow',title:'Отчёт правили несколько раз',version:1,accepted:false,blocked:false});
const body=n=>n==='ev_login_number'?{ok:true,token:'t',person:head}:n==='ev_flags_pending'?{ok:true,from:'2026-10-27',to:today,pending:Array.from({length:12},(_,i)=>mk(['marksa','70let','pereleta'][i%3],'2026-11-'+String(10+i))),accepted:[],coverage:[],yellow_count:12,red_count:0}:n==='ev_cash_on_hand'?{ok:false,error:'mock'}:n==='ev_day_status'?{ok:true,date:today,branches:[]}:{ok:true,rows:[],items:[],shifts:[],branches:[]};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  const b=await pw.chromium.launch();
  const c=await b.newContext({...pw.devices['Pixel 7']});const p=await c.newPage();const cdp=await c.newCDPSession(p);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/rest/v1/rpc/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop()))}));
  await p.goto(url);await wait(400);await p.locator('[data-act="loginstart"]').tap();for(const n of '123123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
  await p.locator('.ui2-home-screen').waitFor({timeout:8000});await wait(800);
  const swipe=async name=>{const h=await p.evaluate(()=>document.documentElement.scrollHeight-innerHeight);assert.ok(h>100,name+': есть что прокручивать ('+h+')');
    const y0=await p.evaluate(()=>scrollY);await cdp.send('Input.synthesizeScrollGesture',{x:187,y:560,yDistance:-450,speed:800,gestureSourceType:'touch'});await wait(700);
    const y1=await p.evaluate(()=>scrollY);assert.ok(y1>y0+100,name+': жест пальцем прокрутил страницу ('+y0+' → '+y1+')');
    await cdp.send('Input.synthesizeScrollGesture',{x:187,y:300,yDistance:600,speed:800,gestureSourceType:'touch'});await wait(500);assert.ok(await p.evaluate(()=>scrollY)<y1,name+': и обратно вверх')};
  await swipe('Главная');
  await p.evaluate(()=>scrollTo(0,0));await p.locator('.ui2-today[data-v="ctl"]').first().tap();await wait(1500);await swipe('Контроль');
  assert.deepEqual(errs,[]);
  const st=await p.evaluate(()=>({bodyOverscroll:getComputedStyle(document.body).overscrollBehaviorY,bodyOx:getComputedStyle(document.body).overflowX,htmlOver:getComputedStyle(document.documentElement).overscrollBehaviorY,hscroll:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  assert.equal(st.bodyOverscroll,'auto');assert.notEqual(st.bodyOx,'hidden');assert.equal(st.htmlOver,'none');assert.ok(st.hscroll<=1,'нет горизонтальной прокрутки');
  await b.close();server.close();console.log('android scroll c23: OK (Pixel 7, touch)');
})().catch(e=>{console.error(e);process.exit(1)});
