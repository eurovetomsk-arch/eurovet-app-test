/* c24: картинки идут «сначала копия, обновление в фоне»; страница, config.js и скрипты — по-прежнему сеть первой.
   Сервер искусственно тормозит PNG на 3 с: с копией иконка из кэша приходит сразу, а в фоне обновляется. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.jpg':'image/jpeg'};
let slowPng=false,pngHits=0,jsHits=0;
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}
  const send=()=>{s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)};
  if(/icons\/\d.*\.png$/.test(rel)){pngHits++;if(slowPng)return setTimeout(send,3000)}
  if(/scripts\/common\.js$/.test(rel))jsHits++;send()});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/?sw=1';
  const b=await pw.chromium.launch();const c=await b.newContext();const p=await c.newPage();
  await p.goto(url);await p.waitForFunction(()=>navigator.serviceWorker.controller||false,null,{timeout:15000}).catch(async()=>{await p.reload()});
  await p.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:15000});await wait(1500);
  slowPng=true;pngHits=0;jsHits=0;
  const t0=Date.now();
  const ms=await p.evaluate(async()=>{const t=performance.now();const r=await fetch('icons/01-evening-report.png');await r.blob();return Math.round(performance.now()-t)});
  assert.ok(ms<1000,'иконка из копии, не ждёт сеть 3 с: '+ms+' мс');
  await wait(3500);assert.ok(pngHits>=1,'в фоне иконка запрошена и обновляется');
  // скрипты — сеть первой: запрос идёт и ответ ждём с сервера
  const before=jsHits;await p.evaluate(async()=>{await (await fetch('scripts/common.js')).text()});assert.ok(jsHits>before,'скрипт запрашивается по сети (сеть первой)');
  await b.close();server.close();console.log('sw static c24: OK (иконка из копии '+ms+' мс, фоновое обновление, скрипты по сети)');
})().catch(e=>{console.error(e);process.exit(1)});
