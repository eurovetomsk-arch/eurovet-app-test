/* c20 (решение Михаила, письмо 3716): Контроль — «Принять всё (N)» принимает красные и жёлтые без второго экрана и причины;
   красные сверху; vm_* «Ждёт сверку Штаба» не принимаются; журнал «Принято». Мок ответов сервера. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const head={id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,roles:['head']};
const mk=(branch,date,code,level,title,extra)=>Object.assign({branch,date,code,level,title,version:1,accepted:false,blocked:false},extra||{});
let pending=[
  mk('marksa','2026-11-16','cash_diff','red','Касса не сходится',{expected:12000,actual:11400,diff:-600}),
  mk('pereleta','2026-11-15','sum_diff','red','Сумма отчёта не сходится',{expected:5000,actual:5200,diff:200}),
  mk('70let','2026-11-17','many_edits','yellow','Отчёт правили несколько раз'),
  mk('marksa','2026-11-14','two_authors','yellow','Отчёт подавали разные люди'),
  mk('marksa','2026-11-17','vm_not_checked','yellow','Не сверено с Vetmanager',{blocked:true}),
];
let accepted=[mk('pereleta','2026-11-10','many_edits','yellow','Отчёт правили несколько раз',{accepted:true,accepted_by:'Соколова А.С.',accepted_at:today+'T05:00:00Z'})];
let calls=[];
function body(name,a){
  switch(name){
    case'ev_login_number':return{ok:true,token:'t',person:head};
    case'ev_flags_pending':return{ok:true,from:'2026-10-27',to:today,pending,accepted,coverage:[],yellow_count:2,red_count:2};
    case'ev_accept_quick':calls.push(a);{
      let n=0;for(const it of a.p_items){const i=pending.findIndex(f=>f.branch===it.branch&&f.date===it.date&&f.code===it.code);if(i>=0&&!pending[i].blocked){accepted.unshift(Object.assign(pending[i],{accepted:true,accepted_by:'Соколова А.С.',accepted_at:new Date().toISOString()}));pending.splice(i,1);n++}}
      return{ok:true,accepted:n,duplicates:0}}
    case'ev_cash_on_hand':return{ok:false,error:'mock'};
    case'ev_day_status':return{ok:true,date:today,branches:[]};
    default:return{ok:true,rows:[],items:[],shifts:[],branches:[]};
  }
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of (process.env.ENGINES||'chromium').split(',')){
    const b=await pw[eng].launch();
    const c=await b.newContext({viewport:{width:375,height:1500},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+String(e.stack).split('\n').slice(1,3).join(';')));
    await p.route('**/rest/v1/rpc/**',async r=>{const n=r.request().url().split('/').pop();let a={};try{a=JSON.parse(r.request().postData()||'{}')}catch(e){}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(n,a))})});
    await p.goto(url);await wait(300);await p.locator('[data-act="loginstart"]').tap();for(const n of '123123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
    await p.locator('.ui2-home-screen').waitFor({timeout:8000});await wait(800);
    await p.locator('.ui2-today[data-v="ctl"]').first().tap();await wait(1800);
    let t=await p.evaluate(()=>document.getElementById('app').innerText);
    if(process.env.DEBUG)console.log(errs.join('|'),await p.locator('[data-v="ctl"]').count(),t.slice(0,300));
    assert.match(t,/Принять всё \(4\)/,eng+': кнопка «Принять всё (4)» (2 красных + 2 жёлтых, vm_* не считается)');
    assert.match(t,/Ждёт сверку Штаба/,eng+': нет «Ждёт сверку Штаба»');
    const kinds=await p.evaluate(()=>[...document.querySelectorAll('#app .card > .chk')].map(e=>e.classList.contains('bad')?'red':'yellow'));
    assert.deepEqual(kinds.slice(0,4),['red','red','yellow','yellow'],eng+': красные сверху: '+kinds);
    assert.equal(await p.locator('[data-act="ctlquick"]').count(),4,eng+': у vm_* нет кнопки «Принять»');
    assert.equal(await p.locator('[data-act="acceptgo"], #accnote').count(),0,eng+': поле причины не нужно');
    if(out)await p.screenshot({path:out+'/1-list.png',fullPage:true});
    // одна строка (красная) — без второго экрана
    await p.locator('[data-act="ctlquick"]').first().tap();await wait(900);
    assert.equal(await p.locator('.ov').count(),0,eng+': второго экрана быть не должно');
    assert.equal(calls.length,1);assert.equal(calls[0].p_items.length,1);assert.equal(calls[0].p_items[0].confirm_money,true);assert.equal(calls[0].p_items[0].code,'cash_diff');
    t=await p.evaluate(()=>document.getElementById('app').innerText);
    assert.match(t,/Принять всё \(3\)/,eng+': после одной осталось 3');
    // принять всё
    await p.locator('[data-act="ctlall"]').tap();await wait(1000);
    assert.equal(calls.length,2);const items=calls[1].p_items;
    assert.equal(items.length,3,eng+': «Принять всё» шлёт 3 позиции (красная+2 жёлтые), без vm_*');
    assert.ok(items.every(i=>i.confirm_money===true),eng+': confirm_money ставит клиент');
    assert.ok(!items.some(i=>i.code.startsWith('vm_')),eng+': vm_* не отправляется');
    assert.ok(items.some(i=>i.code==='sum_diff'),eng+': красная в «Принять всё»');
    t=await p.evaluate(()=>document.getElementById('app').innerText);
    assert.equal(await p.locator('[data-act="ctlall"]').count(),0,eng+': кнопки «Принять всё» больше нет');
    assert.match(t,/Принято \(5\)/,eng+': журнал «Принято (5)»');
    await p.locator('.ctl-done summary').tap();await wait(300);
    if(out)await p.screenshot({path:out+'/2-after-all.png',fullPage:true});
    assert.match(await p.evaluate(()=>document.getElementById('app').innerText),/принял: Соколова А\.С\./);
    assert.deepEqual(errs,[],eng+': ошибки JS '+errs.join('|'));
    console.log(eng,'PASS');await b.close();
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
