const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

function loadPlaywright(){
  for(const id of [process.env.EVROVET_PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{return require(id)}catch(e){if(id==='playwright')throw e}
}
const {chromium}=loadPlaywright();
const root=path.resolve(__dirname,'..');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const old=new Date(today+'T00:00:00Z');old.setUTCDate(old.getUTCDate()-4);const oldDate=old.toISOString().slice(0,10);

(async()=>{
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
  const server=http.createServer((req,res)=>{const rel=decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\/+/, '')||'index.html',file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(b)})});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:375,height:900}});
    await page.route('**/rest/v1/rpc/**',route=>{
      const name=route.request().url().split('/').pop();
      const body=name==='ev_login_number'?{ok:true,token:'qa-token',person:{id:106,full_name:'Руководителей Михаил Романович',short_name:'Руководителей М. Р.',head:true,roles:['head']}}
        :name==='ev_flags_overview'?{ok:true,flags:[],coverage:[{branch:'pereleta',date:oldDate,version:1,status:'missing',checked_at:null,coverage:{}}]}
        :name==='ev_day_status'?{ok:true,branches:[]}
        :name==='ev_cash_on_hand'?{ok:false}
        :{ok:true,rows:[],items:[]};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
    await page.locator('[data-act="loginstart"]').click();
    for(const n of '123123456')await page.locator(`[data-act="logindigit"][data-n="${n}"]`).click();
    await page.locator('.ui2-home-screen').waitFor();
    const reports=page.locator('.ui2-role-tile',{hasText:'Отчёты'});
    await reports.click();
    await page.getByText('Контроль · 7 дней').waitFor();
    await page.waitForTimeout(250);
    await page.getByText('Сверка Vetmanager не проводилась 4 дня').waitFor();
    assert.equal(await page.locator('.chk.warn',{hasText:'Сверка Vetmanager не проводилась'}).count(),1);
    assert.equal(await page.locator('.chk.bad').count(),0,'missing-only wait must not be red');
  }finally{await browser.close();server.close()}
  console.log('VM stale warning: OK (leader yellow after 2 days; missing wait is not red)');
})().catch(e=>{console.error(e);process.exit(1)});
