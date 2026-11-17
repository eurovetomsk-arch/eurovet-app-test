/* c13 (REMARKS п.19, снимки Михаила с iPhone): шторка/окно поверх экрана НЕ должно оставаться после перехода.
   Сквозной тест на touch-эмуляции 375 (Chromium + WebKit): для каждой роли открываем все окна-шторки, нажимаем пункт —
   после перехода шторка закрыта (или заменена другим окном), целевой экран кликабелен (под точкой нажатия не .ov).
   Руководитель: «сдан» → отчёт только для чтения, «не сдан» → карточка без формы. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const P={
  head:{id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,admin:false,roles:['head']},
  admin:{id:16,full_name:'Фёдорова Татьяна Владимировна',short_name:'Фёдорова Т.В.',admin:true,roles:['admin']},
  doctor:{id:2,full_name:'Орлов Илья Петрович',short_name:'Орлов И.П.',work:true,doctor:true,roles:['doctor']},
  assistant:{id:11,full_name:'Семёнова Алина Романовна',short_name:'Семёнова А.Р.',work:true,assistant_clinical:true,roles:['assistant_clinical']},
  callcenter:{id:32,full_name:'Макарова Алёна Викторовна',short_name:'Макарова А.В.',cc:true,roles:['callcenter']}
};
const BR=[{id:'marksa',title:'Маркса, 45'},{id:'70let',title:'70 лет Октября, 20'},{id:'pereleta',title:'Перелёта, 19'}];
function rpcBody(name,a,person){
  switch(name){
    case'ev_login_number':return{ok:true,token:'qa-token',person};
    case'ev_whos_where':return{ok:true,shifts:[
      {date:today,branch:'pereleta',slot:'admin',name:'Дежурова О.В.',full:'Дежурова Ольга Викторовна'},
      {date:today,branch:'marksa',slot:'admin',name:'Маркова С.И.'},
      {date:today,branch:'marksa',slot:'doctor',name:'Врачев И.П.'}]};
    case'ev_day_status':return{ok:true,date:today,branches:BR.map((b,i)=>({branch:b.id,title:b.title,submitted:i===0,version:i===0?1:null,submitted_at:i===0?today+'T09:20:00Z':null,open_flags:0}))};
    case'ev_context':{const cur=a.p_branch==='marksa';
      return{ok:true,branches:BR,admins:[{id:16,name:'Фёдорова Т.В.'}],doctors:[{id:2,name:'Орлов И.П.',vm_id:1}],assistants:[{id:11,role:'assistant_clinical',name:'Семёнова А.Р.'}],prev:null,
        current:cur?{version:1,data:{},submitted_at:today+'T09:20:00Z'}:null,articles:['Хозрасходы']}}
    case'ev_select_branch':return{ok:true,date:today};
    case'ev_cash_handover_context':return{ok:true,mode:'off'};
    case'ev_cash_on_hand':return{ok:false};
    case'ev_cc_today':return{ok:true,date:today,me:false,marked_at:null,ops:0,others:[]};
    case'ev_flags_overview':return{ok:true,flags:[],coverage:[]};
    default:return{ok:true,rows:[],items:[],shifts:[],branches:[]};
  }
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.jpg':'image/jpeg'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404).end();return}
  s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fails=[];const ok=(c,m)=>{if(!c){fails.push(m);console.log('  ✗',m)}};
async function session(browser,url,role){
  const ctx=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.route('**/rest/v1/rpc/**',async route=>{const name=route.request().url().split('/').pop();let a={};try{a=JSON.parse(route.request().postData()||'{}')}catch(e){}
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rpcBody(name,a,P[role]))})});
  await page.goto(url,{waitUntil:'domcontentloaded'});await wait(300);
  await page.locator('[data-act="loginstart"]').tap();
  for(const n of '123123456')await page.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
  await page.locator('.ui2-home-screen').waitFor({timeout:8000}).catch(()=>{});await wait(900);
  return{page,ctx,errs};
}
const ovHtml=p=>p.evaluate(()=>document.getElementById('ovwrap').innerHTML);
/* под центром первой кнопки/ссылки экрана лежит именно экран, а не шторка */
const clickable=p=>p.evaluate(()=>{
  if(document.querySelector('#ovwrap .ov'))return 'ov-open';
  const t=[...document.querySelectorAll('#app button,#app [data-act],#app input')].find(e=>{const r=e.getBoundingClientRect();return r.width>8&&r.height>8&&r.top>=0&&r.bottom<=innerHeight});
  if(!t)return 'none';const r=t.getBoundingClientRect(),el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return el&&(el===t||t.contains(el)||el.contains(t))&&!el.closest('.ov')?'ok':'covered:'+(el?el.className:'null')});
async function openers(role,page){
  /* окна-шторки, которые открывает пользователь этой роли: меню и «вечерний отчёт/выберите филиал» / «отчёты сегодня» */
  const list=[['menu','[data-act="menu"]']];
  if(await page.locator('[data-act="homebranches"]').count())list.push(['homebranches','[data-act="homebranches"]']);
  if(await page.locator('[data-act="repstatus"]').count())list.push(['repstatus','[data-act="repstatus"]']);
  return list;
}
async function runRole(browser,url,role,engine){
  console.log(engine+' '+role);
  let s=await session(browser,url,role);
  const openList=await openers(role,s.page);
  ok(openList.length>=1,engine+' '+role+': нет ни одного окна-шторки для проверки');
  await s.ctx.close();
  for(const [nm,sel] of openList){
    /* число пунктов в шторке */
    s=await session(browser,url,role);
    await s.page.locator(sel).first().tap();await wait(300);
    const n=await s.page.locator('#ovwrap [data-act]:not([data-act="ovclose"])').count();await s.ctx.close();
    ok(n>=1,engine+' '+role+' '+nm+': в шторке нет пунктов');
    for(let i=0;i<n;i++){
      s=await session(browser,url,role);const {page}=s;
      await page.locator(sel).first().tap();await wait(300);
      const items=page.locator('#ovwrap [data-act]:not([data-act="ovclose"])');
      const act=await items.nth(i).getAttribute('data-act');
      const before=await ovHtml(page);
      if(['logout','flush','chpin'].includes(act)){await s.ctx.close();continue} // выход/отправка не про шторку
      await items.nth(i).tap();await wait(900);
      const after=await ovHtml(page);
      const closedOrReplaced=after===''||after!==before;
      ok(closedOrReplaced,engine+' '+role+' '+nm+' → '+act+': шторка осталась поверх экрана');
      if(after===''){const c=await clickable(page);ok(c==='ok'||c==='none',engine+' '+role+' '+nm+' → '+act+': целевой экран не кликабелен ('+c+')')}
      ok(s.errs.length===0,engine+' '+role+' '+nm+' → '+act+': ошибка скрипта '+s.errs[0]);
      await s.ctx.close();
    }
  }
}
async function headFlow(browser,url,engine){
  console.log(engine+' head: «Отчёты сегодня» → филиал');
  let s=await session(browser,url,'head');let {page}=s;
  await page.locator('[data-act="repstatus"]').first().tap();await wait(400);
  await page.locator('#ovwrap [data-act="branch"][data-id="marksa"]').tap();await wait(1200);
  ok((await ovHtml(page))==='',engine+' head: шторка не закрылась после выбора филиала');
  let txt=await page.evaluate(()=>document.getElementById('app').innerText);
  ok(!/Отправить отчёт/.test(await page.evaluate(()=>document.body.innerText)),engine+' head: у сданного отчёта есть кнопка «Отправить отчёт» (должен быть просмотр)');
  ok(/просмотр|только для чтения/i.test(txt),engine+' head: у сданного отчёта нет подписи «просмотр»');
  ok(await page.evaluate(()=>[...document.querySelectorAll('#app input:not([type=hidden]),#app select,#app textarea')].every(e=>e.disabled||e.readOnly)),engine+' head: поля сданного отчёта доступны для правки');
  await s.ctx.close();
  s=await session(browser,url,'head');page=s.page;
  await page.locator('[data-act="repstatus"]').first().tap();await wait(400);
  await page.locator('#ovwrap [data-act="branch"][data-id="pereleta"]').tap();await wait(1200);
  ok((await ovHtml(page))==='',engine+' head: шторка не закрылась (не сдан)');
  txt=await page.evaluate(()=>document.getElementById('app').innerText);
  ok(/Отчёт не сдан/.test(txt),engine+' head: нет карточки «Отчёт не сдан»');
  ok(/Сегодня на смене: Дежурова О\.В\./.test(txt)&&!/Маркова/.test(txt),engine+' head: в карточке нет «Сегодня на смене»');
  ok(await page.locator('#app input:not([type=hidden])').count()===0&&!/Отправить отчёт/.test(await page.evaluate(()=>document.body.innerText)),engine+' head: у «не сдан» показана форма заполнения');
  ok((await clickable(page))!=='covered','head: карточка «не сдан» перекрыта');
  await s.ctx.close();
  /* замена администратора — только из меню, с подтверждением */
  s=await session(browser,url,'head');page=s.page;
  await page.locator('[data-act="menu"]').first().tap();await wait(300);
  const sub=page.locator('#ovwrap [data-act="subadmin"]');
  ok(await sub.count()===1,engine+' head: в меню нет «Заменить администратора»');
  if(await sub.count()){await sub.tap();await wait(300);
    ok(/Заменить администратора|Подтвердите/i.test(await ovHtml(page)),engine+' head: нет окна выбора/подтверждения замены');
    const pick=page.locator('#ovwrap [data-act="subadminpick"]').first();
    if(await pick.count()){await pick.tap();await wait(300);ok(/Подтвердите|Вы заполняете отчёт за/i.test(await ovHtml(page)),engine+' head: замена без подтверждения');
      const yes=page.locator('#ovwrap [data-act="subadminyes"]');if(await yes.count()){await yes.tap();await wait(1200);ok((await ovHtml(page))==='',engine+' head: шторка после подтверждения не закрылась');
        ok(/Отправить отчёт|Приёмка кассы|Начало смены|Касса/i.test(await page.evaluate(()=>document.body.innerText)),engine+' head: после подтверждения не открылась форма отчёта')}}}
  await s.ctx.close();
}
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url=`http://127.0.0.1:${server.address().port}/`;
  const engines=(process.env.ENGINES||'chromium,webkit').split(',');
  for(const e of engines){
    const browser=await pw[e].launch({headless:true});
    for(const role of Object.keys(P))await runRole(browser,url,role,e);
    await headFlow(browser,url,e);
    await browser.close();
  }
  server.close();
  if(fails.length){console.log('\nПРОВАЛЕНО: '+fails.length);process.exit(1)}
  console.log('\noverlay-nav-c13: все проверки пройдены');
})().catch(e=>{console.error(e);process.exit(1)});
