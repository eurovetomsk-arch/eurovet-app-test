const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('/Users/agent/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root=path.resolve(__dirname,'..');
const out=path.join(root,'shots','home-v2');
let appUrl='';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const profiles={
  admin:{id:101,full_name:'Тестова Татьяна Владимировна',short_name:'Тестова Т. В.',admin:true,roles:['admin']},
  doctor:{id:102,full_name:'Лечебная Ольга Викторовна',short_name:'Лечебная О. В.',admin:false,work:true,doctor:true,roles:['doctor']},
  assistant:{id:103,full_name:'Помощникова Анна Сергеевна',short_name:'Помощникова А. С.',admin:false,work:true,assistant_clinical:true,roles:['assistant_clinical']},
  callcenter:{id:104,full_name:'Звонкова Марина Игоревна',short_name:'Звонкова М. И.',admin:false,cc:true,roles:['callcenter']},
  aho:{id:105,full_name:'Снабженцев Павел Андреевич',short_name:'Снабженцев П. А.',admin:false,work:true,cour:true,roles:['courier']},
  head:{id:106,full_name:'Руководителей Михаил Романович',short_name:'Руководителей М. Р.',admin:false,head:true,roles:['head']}
};

async function render(page,person){
  await page.route('**/rest/v1/rpc/**',route=>{
    const name=route.request().url().split('/').pop();
    const body=name==='ev_login_number'?{ok:true,token:'qa-token',person}:name==='ev_whos_where'?{ok:true,rows:[
      {date:today,branch:'marksa',person_id:person.id,mine:true,short_name:person.short_name,start:'09:00',end:'21:00'},
      {date:today,branch:'marksa',person_id:991,short_name:'Иванова О. В.'},
      {date:today,branch:'marksa',person_id:992,short_name:'Петров Д. А.'}
    ]}:{ok:true,rows:[],items:[]};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(appUrl,{waitUntil:'domcontentloaded'});
  await page.locator('#employee-number').fill('123');
  await page.locator('#pin').fill('123456');
  await page.locator('[data-act="login"]').click();
  await page.locator('.ui2-home-screen').waitFor();
  await page.waitForFunction(()=>!document.body.innerText.includes('Загружаю сегодняшнюю смену'));
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
  const server=http.createServer((req,res)=>{const rel=decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\/+/, '')||'index.html';const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(b)})});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  appUrl=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [375,320])for(const [role,person] of Object.entries(profiles)){
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      await render(page,person);
      await page.screenshot({path:path.join(out,`${width}-${role}.png`),fullPage:false});
      await page.close();
    }
  }finally{await browser.close();server.close()}
  console.log(`home 2.0 shots: ${Object.keys(profiles).length*2} PNG`);
})().catch(e=>{console.error(e);process.exit(1)});
