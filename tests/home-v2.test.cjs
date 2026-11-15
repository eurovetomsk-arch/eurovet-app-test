const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
function loadPlaywright(){
  const candidates=[process.env.EVROVET_PLAYWRIGHT_MODULE,'playwright'].filter(Boolean);
  for(const id of candidates)try{return require(id)}catch(e){if(id===candidates[candidates.length-1])throw e}
}
const {chromium,firefox,webkit}=loadPlaywright();

const root=path.resolve(__dirname,'..');
let appUrl='';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const profiles={
  admin:{id:101,full_name:'Тестова Татьяна Владимировна',short_name:'Тестова Т. В.',admin:true,roles:['admin']},
  doctor:{id:102,full_name:'Лечебная Ольга Викторовна',short_name:'Лечебная О. В.',admin:false,work:true,doctor:true,roles:['doctor']},
  assistant:{id:103,full_name:'Помощникова Анна Сергеевна',short_name:'Помощникова А. С.',admin:false,work:true,assistant_clinical:true,roles:['assistant_clinical']},
  callcenter:{id:104,full_name:'Звонкова Марина Игоревна',short_name:'Звонкова М. И.',admin:false,cc:true,roles:['callcenter']},
  courier:{id:105,full_name:'Снабженцев Павел Андреевич',short_name:'Снабженцев П. А.',admin:false,work:true,cour:true,roles:['courier']},
  head:{id:106,full_name:'Руководителей Михаил Романович',short_name:'Руководителей М. Р.',admin:false,head:true,roles:['head']}
};

async function stub(page,person){
  await page.route('**/rest/v1/rpc/**',async route=>{
    const name=route.request().url().split('/').pop();
    if(name==='ev_login_number')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,token:'qa-token',person})});
    if(name==='ev_whos_where')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,rows:[
      {date:today,branch:'marksa',person_id:person.id,mine:true,short_name:person.short_name,start:'09:00',end:'21:00'},
      {date:today,branch:'marksa',person_id:991,short_name:'Иванова О. В.'},
      {date:today,branch:'marksa',person_id:992,short_name:'Петров Д. А.'}
    ]})});
    if(name==='ev_day_status')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,branches:[
      {branch:'marksa',submitted:true,open_flags:0},{branch:'70let',submitted:true,open_flags:0},{branch:'pereleta',submitted:false,open_flags:0}
    ]})});
    if(name==='ev_cash_on_hand')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false})});
    if(name==='ev_mr_list'||name==='ev_leave_pending')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[]})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,rows:[],items:[]})});
  });
}

async function login(page,person){
  await stub(page,person);
  await page.goto(appUrl,{waitUntil:'domcontentloaded'});
  await page.locator('[data-act="loginstart"]').click();
  for(const n of '123123456')await page.locator(`[data-act="logindigit"][data-n="${n}"]`).click();
  await page.locator('.ui2-home-screen').waitFor();
  await page.waitForFunction(()=>!document.body.innerText.includes('Загружаю сегодняшнюю смену'));
}

async function inspect(engineName,engine){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [320,375,414,768,1280]){
      for(const [role,person] of Object.entries(profiles)){
        const page=await browser.newPage({viewport:{width,height:900}});
        const errors=[];page.on('pageerror',e=>errors.push(String(e)));
        await login(page,person);
        const body=await page.locator('body').innerText();
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        assert.ok(overflow<=1,`${engineName}/${width}/${role}: horizontal overflow ${overflow}`);
        assert.equal(errors.length,0,`${engineName}/${width}/${role}: ${errors.join('; ')}`);
        if(role==='head'){assert.match(body,/Отчёты сегодня: 2 из 3/);assert.match(body,/Ждём: Перелёта/)}
        else{assert.match(body,/Сегодня вы на Маркса/);assert.match(body,/С вами: Иванова О\. В\., Петров Д\. А\./)}
        const nav=await page.locator('.ui2-bottom-nav button').allTextContents();
        assert.deepEqual(nav,role==='courier'?['Главная','Начисления','Меню']:['Главная','График','Начисления','Меню']);
        if(role==='admin'){for(const t of ['Вечерний отчёт','Приём кассы','Вакцины','Препараты и расходники'])assert.match(body,new RegExp(t))}
        if(role==='doctor')for(const t of ['Мои записи','Вакцины','Расчёт дозы','Препараты и расходники'])assert.match(body,new RegExp(t));
        if(role==='assistant')for(const t of ['Мои начисления','Где я работаю','Вакцины','Расчёт дозы','Препараты и расходники'])assert.match(body,new RegExp(t));
        if(role==='callcenter')for(const t of ['Мои смены','Мои начисления','Вакцины','Где я работаю'])assert.match(body,new RegExp(t));
        if(role==='head'){for(const t of ['Деньги','Отчёты','Касса и сейф','Зарплаты','Заявки филиалов','Вакцины по филиалам','Расчёт дозы','Люди и доступы','Отчёт филиала'])assert.match(body,new RegExp(t))}
        if(role==='courier'){for(const t of ['Мои начисления','Вакцины по филиалам','Заявки филиалов','Заказ снабжения'])assert.match(body,new RegExp(t));assert.doesNotMatch(body,/График/)}
        if(role!=='head')assert.doesNotMatch(body,/Выручка, касса и сейфы всех филиалов/);
        const sectionTitles=await page.locator('.ui2-group-title').allTextContents();
        const expectedOrder=['Финансы','Препараты','Смена','Клиника'].filter(x=>sectionTitles.includes(x));
        assert.deepEqual(sectionTitles,expectedOrder,`${engineName}/${width}/${role}: section order`);
        if(['doctor','assistant','head'].includes(role))assert.equal(await page.locator('.ui2-dose-icon').count(),1,`${engineName}/${width}/${role}: dose icon`);
        if(role==='assistant'){
          const supply=page.locator('.ui2-role-tile',{hasText:'Препараты и расходники'}),grid=supply.locator('..');
          const [sbox,gbox]=await Promise.all([supply.boundingBox(),grid.boundingBox()]);
          assert.ok(sbox&&gbox&&Math.abs(sbox.width-gbox.width)<2,`${engineName}/${width}: assistant lone last tile not full width`);
        }
        await page.close();
      }
    }
  }finally{await browser.close()}
}

(async()=>{
  try{
    const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
    const server=http.createServer((req,res)=>{const rel=decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\/+/, '')||'index.html';const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(b)})});
    await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
    appUrl=`http://127.0.0.1:${server.address().port}/`;
    try{
      for(const [name,engine] of Object.entries({chromium,firefox,webkit}))await inspect(name,engine);
      for(const [engineName,engine] of Object.entries({chromium,firefox,webkit})){
        const browser=await engine.launch({headless:true});
        try{
          const entry=await browser.newPage({viewport:{width:375,height:900}});
          await entry.goto(appUrl,{waitUntil:'domcontentloaded'});
          assert.equal(await entry.locator('.ui2-halo svg use').getAttribute('href'),'#evro',engineName+' entry evro symbol');
          assert.equal(await entry.locator('.ui2-wordmark svg use').getAttribute('href'),'#evro',engineName+' wordmark evro symbol');
          await entry.locator('[data-act="loginstart"]').click();
          const pad=await entry.locator('.ui2-pad').boundingBox(),buttons=await entry.locator('.ui2-pad button:not(.blank)').all();
          assert.ok(pad&&pad.width>320,engineName+' keypad is not full width at 375');
          for(const button of buttons){const box=await button.boundingBox();assert.ok(box&&box.width>=72,engineName+' keypad button below 72px')}
          await entry.close();
          const dual=await browser.newPage({viewport:{width:375,height:900}});
          await login(dual,{...profiles.doctor,admin:true,roles:['doctor','admin']});
          const body=await dual.locator('body').innerText();
          for(const title of ['Вечерний отчёт','Приём кассы','Мои записи','Расчёт дозы'])assert.match(body,new RegExp(title));
          assert.doesNotMatch(body,/Выручка, касса и сейфы всех филиалов/);
          await dual.close();
          const leader=await browser.newPage({viewport:{width:375,height:900}});
          await login(leader,{...profiles.head,admin:true,roles:['head','admin']});
          const leaderBody=await leader.locator('body').innerText();
          for(const title of ['Люди и доступы','Вечерний отчёт','Деньги'])assert.match(leaderBody,new RegExp(title),engineName+' leader union');
          await leader.close();
          const neutral=await browser.newPage({viewport:{width:375,height:900}});
          await login(neutral,{id:199,full_name:'Безролевой Тест Тестович',short_name:'Безролевой Т. Т.',work:true,roles:[]});
          const neutralBody=await neutral.locator('body').innerText();
          for(const title of ['Вечерний отчёт','Мои записи','Мои начисления','Деньги'])assert.doesNotMatch(neutralBody,new RegExp(title),engineName+' no-role fallback');
          await neutral.close();
        }finally{await browser.close()}
      }
    }finally{server.close()}
  }catch(e){throw e}
  console.log('home 2.0: OK (6 roles, dual-role union, 5 widths, 3 engines)');
})().catch(e=>{console.error(e);process.exit(1)});
