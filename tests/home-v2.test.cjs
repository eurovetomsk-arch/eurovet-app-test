const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,firefox,webkit}=require('/Users/agent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

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
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,rows:[],items:[]})});
  });
}

async function login(page,person){
  await stub(page,person);
  await page.goto(appUrl,{waitUntil:'domcontentloaded'});
  await page.locator('#employee-number').fill('123');
  await page.locator('#pin').fill('123456');
  await page.locator('[data-act="login"]').click();
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
        assert.match(body,/Сегодня вы на Маркса/);
        assert.match(body,/С вами: Иванова О\. В\., Петров Д\. А\./);
        assert.doesNotMatch(body,/Вакцины|Расчёт доз|Препараты и расходники|Модули и роли/);
        const nav=await page.locator('.ui2-bottom-nav button').allTextContents();
        assert.deepEqual(nav,role==='courier'?['Главная','Начисления','Меню']:['Главная','График','Начисления','Меню']);
        if(role==='admin'){assert.match(body,/Вечерний отчёт/);assert.match(body,/Приём кассы/)}
        if(role==='doctor')assert.match(body,/Мои записи/);
        if(role==='callcenter')assert.match(body,/Мои смены/);
        if(role==='head'){assert.match(body,/Деньги/);assert.match(body,/Отчёты/);assert.match(body,/Касса и сейф/);assert.match(body,/Зарплаты/)}
        if(role==='courier'){assert.match(body,/Специалист АХО/);assert.doesNotMatch(body,/График/)}
        if(role!=='head')assert.doesNotMatch(body,/Выручка, касса и сейфы всех филиалов/);
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
      const browser=await chromium.launch({headless:true});
      try{
        const page=await browser.newPage({viewport:{width:375,height:900}});
        await login(page,{...profiles.doctor,admin:true,roles:['doctor','admin']});
        const body=await page.locator('body').innerText();
        for(const title of ['Вечерний отчёт','Приём кассы','Мои записи'])assert.match(body,new RegExp(title));
        assert.doesNotMatch(body,/Выручка, касса и сейфы всех филиалов/);
      }finally{await browser.close()}
    }finally{server.close()}
  }catch(e){throw e}
  console.log('home 2.0: OK (6 roles, dual-role union, 5 widths, 3 engines)');
})().catch(e=>{console.error(e);process.exit(1)});
