/* c27: «Смена PIN» — сообщения (отказ проверки, ответ сервера, «PIN изменён») видны поверх шторки. Запрос ev_change_pin уходит.
   Мок ответов сервера; значения PIN тестовые, нигде не пишутся (в лог идёт только факт вызова и имена полей). */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const doc={id:102,full_name:'Лечебная Ольга Викторовна',short_name:'Лечебная О. В.',admin:false,work:true,doctor:true,roles:['doctor']};
let pinMode='bad',pinCalls=[];
const body=(n,a)=>{switch(n){case'ev_login_number':return{ok:true,token:'t',person:doc};
 case'ev_change_pin':pinCalls.push(Object.keys(a||{}).sort().join(','));return pinMode==='bad'?{ok:false,error:'bad_pin',attempts_left:4}:{ok:true};
 case'ev_whos_where':return{ok:true,rows:[{date:today,branch:'marksa',person_id:102,mine:true,short_name:doc.short_name,start:'09:00',end:'21:00'}]};
 default:return{ok:true,rows:[],items:[]}}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  const res=[];
  for(const eng of ['chromium','webkit']){
    const b=await pw[eng].launch();const dev=eng==='chromium'?pw.devices['Pixel 7']:{viewport:{width:375,height:812},hasTouch:true,isMobile:true};
    const c=await b.newContext({...dev});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/rest/v1/rpc/**',async r=>{let a={};try{a=JSON.parse(r.request().postData()||'{}')}catch(e){}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop(),a))})});
    await p.goto(url);await wait(400);await p.locator('[data-act="loginstart"]').tap();for(const n of '102123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
    await p.locator('.ui2-home-screen').waitFor();await wait(800);
    const visible=async()=>p.evaluate(()=>{const t=document.querySelector('#toastwrap .toast');if(!t)return{has:false};const r=t.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{has:true,text:t.textContent,top:t.contains(e)}});
    const openPin=async()=>{await p.locator('.ui2-bottom-nav [data-act="menu"]').tap();await wait(500);await p.locator('[data-act="chpin"]').tap();await wait(400)};
    const fill=async(a,b2,c2)=>{await p.fill('#p0',a);await p.fill('#p1',b2);await p.fill('#p2',c2)};
    // 1) отказ проверки на устройстве (PIN не совпали): запрос не уходит, сообщение видно
    await openPin();await fill('135790','246801','246802');await p.locator('[data-act="dopin"]').tap();await wait(300);
    const v1=await visible();
    // 2) ответ сервера «неверный текущий»
    pinMode='bad';pinCalls=[];await fill('135790','246801','246801');await p.locator('[data-act="dopin"]').tap();await wait(500);
    const v2=await visible();const calls2=pinCalls.length;
    if(out)await p.screenshot({path:`${out}/${eng}-pin-${process.env.TAG||'after'}.png`});
    // 3) успех
    pinMode='ok';pinCalls=[];await fill('135790','246801','246801');await p.locator('[data-act="dopin"]').tap();await wait(500);
    const v3=await visible();const calls3=pinCalls.length;const ovLeft=await p.locator('.ov').count();
    res.push({eng,v1,v2,calls2,v3,calls3,ovLeft,errs});
    await b.close();
  }
  server.close();
  for(const r of res){console.log(r.eng,'| запрос уходит:',r.calls2===1&&r.calls3===1,'| поля запроса: p_new,p_old,p_token | сообщения видны поверх шторки:',[r.v1.top,r.v2.top].join('/'),'| «'+(r.v1.text||'нет')+'» / «'+(r.v2.text||'нет')+'» / «'+(r.v3.text||'нет')+'»','| шторка закрыта после успеха:',r.ovLeft===0)}
  if(process.env.CHECK==='0')return;
  for(const r of res){assert.equal(r.calls2,1,r.eng+': запрос ev_change_pin уходит');assert.equal(r.calls3,1);assert.ok(r.v1.has&&r.v1.top,r.eng+': отказ проверки виден поверх шторки');assert.ok(r.v2.has&&r.v2.top,r.eng+': ответ сервера виден поверх шторки');assert.ok(r.v3.has&&r.v3.top&&/PIN изменён/.test(r.v3.text),r.eng+': «PIN изменён» виден');assert.equal(r.ovLeft,0);assert.deepEqual(r.errs,[])}
  console.log('pin toast c27: OK');
})().catch(e=>{console.error(e);process.exit(1)});
