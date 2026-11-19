/* c30: Контроль — флаги сверки Vetmanager старше 14 дней (граница = сегодня-14) уходят в свёрнутый раздел «Старые, сверка невозможна (N)»:
   не красные, не в «Ждут решения» и «Сверка не завершена», не в красной плашке; свежие остаются как были; граница сдвигается с датой. Мок ответов сервера: 27 старых, 3 свежих. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const todayReal=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const add=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const head={id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,roles:['head']};
const BR=['marksa','70let','pereleta'];
// 27 старых дат: today-40 … today-14-1 (в каждом по филиалу по кругу); 3 свежих у 70let: today-9, -3, -1
const oldDates=Array.from({length:27},(_,i)=>add(todayReal,-41+i)); // до today-15 включительно
const freshDates=[add(todayReal,-9),add(todayReal,-3),add(todayReal,-1)];
const cov=(branch,date,status)=>({branch,date,status,version:1,coverage:{}});
const flag=(branch,date,code,level)=>({branch,date,code,level,title:code==='vm_partial'?'Сверка с Vetmanager неполная':'Не сверено с Vetmanager',version:1,accepted:false,blocked:true});
const coverage=[...oldDates.map((d,i)=>cov(BR[i%3],d,'incomplete')),...freshDates.map(d=>cov('70let',d,'incomplete')),cov('marksa',todayReal,'complete')];
const pending=[...oldDates.map((d,i)=>flag(BR[i%3],d,i%2?'vm_partial':'vm_not_checked','yellow')),...freshDates.map(d=>flag('70let',d,'vm_partial','yellow'))];
let shift=0,mockToday=todayReal;
const body=n=>{switch(n){case'ev_login_number':return{ok:true,token:'t',person:head};
 case'ev_flags_pending':return{ok:true,from:'2026-10-27',to:mockToday,pending,accepted:[],coverage,yellow_count:30,red_count:0};
 case'ev_cash_on_hand':return{ok:false,error:'mock'};case'ev_day_status':return{ok:true,branches:[]};
 default:return{ok:true,rows:[],items:[],shifts:[],branches:[]}}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of ['chromium','webkit']){
    const b=await pw[eng].launch();const c=await b.newContext({viewport:{width:375,height:1400},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/rest/v1/rpc/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop()))}));
    await p.goto(url);await wait(400);await p.locator('[data-act="loginstart"]').tap();for(const n of '123123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
    await p.locator('.ui2-home-screen,.ui2-today').first().waitFor({timeout:8000});await wait(800);
    // красная плашка статуса на главной/выручке руководителя
    await p.evaluate(()=>loadRevStatus());await wait(1200);
    if(process.env.TAG==='before'){const rs0=await p.evaluate(()=>S.revStatus);await p.evaluate(()=>showControl());await wait(1500);if(out)await p.screenshot({path:`${out}/${eng}-control-old-before.png`,fullPage:true});console.log(eng,'до правки: плашка',JSON.stringify(rs0),'| «'+((await p.evaluate(()=>document.getElementById('app').innerText)).match(/Ждут решения: \d+/)||[''])[0]+'», «'+((await p.evaluate(()=>document.getElementById('app').innerText)).match(/Сверка Vetmanager не завершена: \d+/)||[''])[0]+'»');await b.close();continue}
    const rs=await p.evaluate(()=>S.revStatus);assert.equal(rs.incomplete,3,eng+': в красной плашке только свежие (3), не 30: '+JSON.stringify(rs));assert.equal(rs.open,0,eng+': «ждут решения» без vm-находок');
    await p.evaluate(()=>showControl());await wait(1500);
    const info=()=>p.evaluate(()=>{const t=document.getElementById('app').innerText;const d=document.querySelector('details.ctl-old');return{text:t,old:d?d.querySelector('summary').textContent.trim():null,open:d?d.open:null,rows:d?d.querySelectorAll('.ctl-old-row').length:0,bad:[...document.querySelectorAll('#app .chk.bad')].map(e=>e.innerText.replace(/\s+/g,' ').slice(0,60)),waitLine:(t.match(/Ждут решения: \d+/)||[''])[0],incLine:(t.match(/Сверка Vetmanager не завершена: \d+/)||[''])[0]}});
    let r=await info();
    assert.equal(r.old,'Старые, сверка невозможна (27)',eng+': раздел «Старые (27)»');assert.equal(r.open,false,eng+': раздел свёрнут');assert.equal(r.rows,27,eng+': в разделе 27 строк с датой, филиалом и причиной');
    assert.equal(r.waitLine,'Ждут решения: 3',eng+': «Ждут решения» = 3 свежих');assert.equal(r.incLine,'Сверка Vetmanager не завершена: 3',eng+': не завершена = 3 свежих');assert.equal(r.bad.length,1,eng+': одна красная плашка (3 свежих)');
    const fresh=await p.evaluate(()=>[...document.querySelectorAll('#app .chk')].filter(e=>!e.closest('details')).length);
    assert.ok(/70 лет Октября/.test(r.text),eng+': свежие 70let видны');
    await p.evaluate(()=>{document.querySelector('details.ctl-old').open=true});const first=await p.evaluate(()=>document.querySelector('.ctl-old-row').innerText.replace(/\s+/g,' '));
    assert.ok(/\d{2}\.\d{2}\.\d{4}/.test(first)&&/Сверка|Данных|Нужно/.test(first),eng+': строка раздела: дата, филиал, причина «'+first+'»');
    if(out)await p.screenshot({path:`${out}/${eng}-control-old-${process.env.TAG||'after'}.png`,fullPage:true});
    // граница сдвигается с датой: «завтра» старыми становятся ещё и today-14 -> сегодняшние свежие остаются свежими, а date=today-14 (сегодня свежая) завтра станет старой
    const edge=await p.evaluate(()=>{const t=omskToday();const b=addDays(t,-14);return{boundary:b,onBoundaryOld:ctlOldDate(b),dayBeforeOld:ctlOldDate(addDays(b,-1)),dayAfterOld:ctlOldDate(addDays(b,1))}});
    assert.equal(edge.onBoundaryOld,false,eng+': дата today-14 ещё свежая (сверка возможна)');assert.equal(edge.dayBeforeOld,true,eng+': today-15 — старая');assert.equal(edge.dayAfterOld,false);
    /* «через k дней» = те же данные, но все даты на k дней раньше относительно сегодняшнего дня */
    const shiftedN=k=>p.evaluate(k2=>{const mv=d=>addDays(d,-k2);const fl=(S.ctl||[]).map(f=>Object.assign({},f,{date:mv(f.date)})),cv=(S.ctlCoverage||[]).map(x=>Object.assign({},x,{date:mv(x.date)}));return ctlOldRows(fl,cv).length},k);
    assert.equal(await shiftedN(0),27,eng+': сегодня 27 старых');
    assert.equal(await shiftedN(6),28,eng+': через 6 дней граница today-8: свежая (today-9) становится старой — 28');
    assert.equal(await shiftedN(20),30,eng+': через 20 дней все 30 старые')
    assert.deepEqual(errs,[],eng+': JS-ошибки '+errs.join('|'));
    await b.close();console.log(eng+' PASS (27 старых свёрнуто, 3 свежих красные)');
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
