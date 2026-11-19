/* c29: «Мои записи» в «Графике»: у врача (и руководителя с ролью doctor) тап по своему дню показывает «Мои записи · дата» и вызывает ev_my_appointments(p_from,p_to);
   у администратора без роли врача записей нет, запрос не уходит. Вход по номеру, роли приходят в person.roles (без подставного списка людей). Мок ответов сервера. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const people={
  doctor:{id:102,full_name:'Лечебная Ольга Викторовна',short_name:'Лечебная О. В.',doctor:true,work:true,roles:['doctor']},
  headdoc:{id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,doctor:true,roles:['head','doctor']},
  admin:{id:101,full_name:'Тестова Татьяна Владимировна',short_name:'Тестова Т. В.',admin:true,roles:['admin']}
};
let who='doctor',apptCalls=[];
const body=(n,a)=>{switch(n){
  case'ev_login_number':return{ok:true,token:'t',person:people[who]};
  case'ev_my_appointments':apptCalls.push(a);return{ok:true,status:'complete',updated_at:Date.now(),rows:[{id:'a1',date:today,time:'10:00',end:'10:30',branch:'marksa',status:'booked',alias:'Бобик',species:'Собака'}]};
  case'ev_whos_where':{const row=[{date:today,branch:'marksa',person_id:people[who].id,mine:true,short_name:people[who].short_name,role:'doctor',start:'09:00',end:'21:00'}];return{ok:true,rows:row,shifts:row}}
  case'ev_flags_pending':return{ok:true,from:'2026-10-27',to:today,pending:[],accepted:[],coverage:[],yellow_count:0,red_count:0};
  case'ev_cash_on_hand':return{ok:false,error:'mock'};
  default:return{ok:true,rows:[],items:[],shifts:[],branches:[]}}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of ['chromium','webkit']){
    const b=await pw[eng].launch();
    for(const k of ['doctor','headdoc','admin']){
      who=k;apptCalls=[];
      const c=await b.newContext({viewport:{width:375,height:900},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.route('**/rest/v1/rpc/**',r=>{let a={};try{a=JSON.parse(r.request().postData()||'{}')}catch(e){}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop(),a))})});
      await p.goto(url);await wait(400);await p.locator('[data-act="loginstart"]').tap();for(const n of '102123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
      await p.locator('.ui2-home-screen').waitFor({timeout:8000});await wait(600);
      assert.equal(await p.evaluate(()=>S.loginList.length),0,eng+k+': список людей пуст (как в живом)');
      await p.locator('.ui2-bottom-nav button:has-text("График")').tap();await wait(1500);
      const tab=p.locator('[data-act="schtab"][data-t="my"]');if(await tab.count()){await tab.tap();await wait(600)}
      const day=p.locator('.cal [data-act="schappt"]').filter({hasText:String(Number(today.slice(8)))}).first();
      assert.ok(await day.count(),eng+k+': свой цветной день есть');await day.tap();await wait(1500);
      const t=await p.evaluate(()=>document.getElementById('app').innerText);
      if(k==='admin'){assert.equal(apptCalls.length,0,eng+': админ без роли врача — запрос записей не уходит');assert.ok(!/Мои записи/.test(t),eng+': админу «Мои записи» не показываем')}
      else{
        assert.equal(apptCalls.length,1,eng+k+': ev_my_appointments вызван');assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(apptCalls[0].p_from)&&/^\d{4}-\d{2}-\d{2}$/.test(apptCalls[0].p_to),eng+k+': p_from/p_to заданы');
        assert.match(t,/Мои записи · /,eng+k+': «Мои записи · дата» показано');assert.match(t,/Бобик/,eng+k+': запись видна');
        if(out&&k==='doctor')await p.screenshot({path:`${out}/${eng}-appointments.png`,fullPage:false});
      }
      assert.deepEqual(errs,[],eng+k+': JS-ошибки '+errs.join('|'));await c.close();
    }
    await b.close();console.log(eng+' PASS (врач, руководитель-врач, администратор)');
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
