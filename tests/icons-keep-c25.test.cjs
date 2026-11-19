/* c25: иконки плиток и логотип не мигают при перерисовке: у <img> есть размеры и decoding=sync, декодированные копии живут в памяти (IMG_KEEP),
   новые узлы после render() сразу готовы (complete, naturalWidth>0) в том же кадре. Мок ответов сервера. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const doc={id:102,full_name:'Лечебная Ольга Викторовна',short_name:'Лечебная О. В.',admin:false,work:true,doctor:true,roles:['doctor']};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const body=n=>n==='ev_login_number'?{ok:true,token:'t',person:doc}:n==='ev_whos_where'?{ok:true,rows:[{date:today,branch:'marksa',person_id:102,mine:true,short_name:doc.short_name,start:'09:00',end:'21:00'}]}:{ok:true,rows:[],items:[]};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of ['chromium','webkit']){
    const b=await pw[eng].launch();const c=await b.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/rest/v1/rpc/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop()))}));
    await p.goto(url);await wait(400);await p.locator('[data-act="loginstart"]').tap();for(const n of '102123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
    await p.locator('.ui2-home-screen').waitFor();await wait(1500);
    const r=await p.evaluate(()=>{const imgs=[...document.querySelectorAll('.ui2-role-tile img')];const first=imgs[0];render();const after=[...document.querySelectorAll('.ui2-role-tile img')];const logo=document.querySelector('header img.logo');
      return{tiles:imgs.length,recreated:after[0]!==first,readyNow:after.every(i=>i.complete&&i.naturalWidth>0),attrs:after.every(i=>i.getAttribute('width')==='58'&&i.getAttribute('decoding')==='sync'),logoAttrs:!!logo&&logo.getAttribute('width')==='42'&&logo.getAttribute('decoding')==='sync',logoReady:!!logo&&logo.complete&&logo.naturalWidth>0,kept:IMG_KEEP.size,keptHasMark:IMG_KEEP.has('mark.svg')}});
    assert.ok(r.tiles>=5,eng+': плитки с иконками есть '+r.tiles);
    assert.ok(r.recreated,eng+': узлы пересоздаются при render (поэтому нужен кэш в памяти)');
    assert.ok(r.readyNow,eng+': иконки готовы сразу после render');assert.ok(r.attrs,eng+': размеры и decoding=sync у иконок');
    assert.ok(r.logoAttrs&&r.logoReady,eng+': логотип с размерами и готов');assert.ok(r.kept>=r.tiles-1&&r.keptHasMark,eng+': копии в памяти '+r.kept);
    assert.deepEqual(errs,[],eng+': JS-ошибки');
    await b.close();console.log(eng+' PASS ('+r.tiles+' плиток, в памяти '+r.kept+')');
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
