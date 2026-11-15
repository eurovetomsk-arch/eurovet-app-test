const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
function loadPlaywright(){
  for(const id of [process.env.EVROVET_PLAYWRIGHT_MODULE,'playwright'].filter(Boolean))try{return require(id)}catch(e){if(id==='playwright')throw e}
}
const {chromium}=loadPlaywright();
const root=path.resolve(__dirname,'..');
const expected=[
  'Ваша смена — наша забота','Мы ценим вас каждый день','Спасибо, что вы с нами','Вы — сердце нашей клиники','Мы рядом в каждой смене',
  'Вы делаете мир добрее','С заботой о вашей работе','Сделано для вас','Ваша смена стала проще','Всё под рукой — для вас'
];

async function fakeDeviceDate(page,iso){
  await page.addInitScript(value=>{
    const RealDate=Date,fixed=new RealDate(value+'T12:00:00');
    class FakeDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed.getTime()]))}static now(){return fixed.getTime()}}
    globalThis.Date=FakeDate;
  },iso);
}

(async()=>{
  const cfg=fs.readFileSync(path.join(root,'config.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(cfg,/sloganRotate:true/);
  for(const s of expected)assert.ok(cfg.includes("'"+s+"'"),'missing slogan: '+s);
  assert.match(html,/Date\.UTC\(d\.getFullYear\(\),d\.getMonth\(\),d\.getDate\(\)\)/);
  assert.match(html,/deviceDayOfYear\(d\)%a\.length/);
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
  const server=http.createServer((req,res)=>{const rel=decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\/+/, '')||'index.html';const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(b)})});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const url=`http://127.0.0.1:${server.address().port}/`,browser=await chromium.launch({headless:true});
  try{
    const seen=[];
    for(let day=1;day<=10;day++){
      const page=await browser.newPage({viewport:{width:320,height:900}});
      await fakeDeviceDate(page,`2026-01-${String(day).padStart(2,'0')}`);
      await page.goto(url,{waitUntil:'domcontentloaded'});
      const lead=page.locator('.ui2-login-lead');
      seen.push((await lead.textContent()).trim());
      const style=await lead.evaluate(el=>getComputedStyle(el).whiteSpace);
      assert.equal(style,'nowrap',`day ${day}: slogan wrapped`);
      assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=1,`day ${day}: 320 overflow`);
      await page.close();
    }
    assert.equal(new Set(seen).size,10,'ten consecutive device dates must show ten distinct slogans');
    assert.deepEqual(new Set(seen),new Set(expected),'rotation must use only the approved ten slogans');
  }finally{await browser.close();server.close()}
  console.log('slogans 3014: OK (10 dates, exact list, 320px nowrap)');
})().catch(e=>{console.error(e);process.exit(1)});
