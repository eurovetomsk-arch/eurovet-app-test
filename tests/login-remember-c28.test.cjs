/* c28 + c31: запоминание личного номера (c31: приложение всегда открывается на стартовом экране; «Войти» подставляет номер) на устройстве. Хранится только номер (3 цифры): PIN, токен, имя — нет. «Это не я» стирает номер. Выход номер не стирает.
   Мок ответов сервера; тестовые цифры. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const doc={id:102,full_name:'Лечебная Ольга Викторовна',short_name:'Лечебная О. В.',admin:false,work:true,doctor:true,roles:['doctor']};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let logins=[];
const body=(n,a)=>{switch(n){case'ev_login_number':logins.push(a.p_number);return a.p_pin==='246801'?{ok:true,token:'tok-secret-xyz',person:doc}:{ok:false,error:'bad_pin',attempts_left:4};
 case'ev_whos_where':return{ok:true,rows:[{date:today,branch:'marksa',person_id:102,mine:true,short_name:doc.short_name,start:'09:00',end:'21:00'}]};
 default:return{ok:true,rows:[],items:[]}}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of ['chromium','webkit']){
    const b=await pw[eng].launch();const dev=eng==='chromium'?pw.devices['Pixel 7']:{viewport:{width:375,height:812},hasTouch:true,isMobile:true};
    const c=await b.newContext({...dev});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route('**/rest/v1/rpc/**',r=>{let a={};try{a=JSON.parse(r.request().postData()||'{}')}catch(e){}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(r.request().url().split('/').pop(),a))})});
    const tapDigits=async s=>{for(const n of s)await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap()};
    const ls=()=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
    const screen=()=>p.evaluate(()=>({start:!!document.querySelector('[data-act="loginstart"]'),step:S.loginStep,num:S.loginNumber,notme:!!document.querySelector('[data-act="loginnotme"]'),text:document.getElementById('app').innerText.replace(/\n+/g,' ').slice(0,120)}));
    // 1) первый вход без сохранённого номера: стартовый экран, ввод номера и PIN
    await p.goto(url);await wait(500);let sc=await screen();assert.ok(sc.start,eng+': без номера — стартовый экран «Войти»');
    await p.locator('[data-act="loginstart"]').tap();await tapDigits('123');sc=await screen();assert.equal(sc.step,'pin');
    await tapDigits('246801');await p.locator('.ui2-home-screen').waitFor({timeout:8000});assert.deepEqual(logins,['123']);
    // что лежит на устройстве: только номер
    let st=await ls();assert.equal(st.ev_login_number,'123',eng+': номер сохранён');
    const dump=JSON.stringify(st);assert.ok(!dump.includes('246801'),eng+': PIN не хранится');assert.ok(!dump.includes('tok-secret-xyz'),eng+': токен не хранится');assert.ok(!dump.includes('Лечебная'),eng+': имя не хранится');
    // 2) открыли приложение заново: номер подставлен, остаётся PIN
    await p.reload();await wait(700);sc=await screen();
    assert.ok(sc.start&&!sc.notme,eng+': c31: открытие без токена — стартовый экран, не PIN '+JSON.stringify(sc));
    if(out)await p.screenshot({path:`${out}/${eng}-start-remembered.png`});
    await p.locator('[data-act="loginstart"]').tap();await wait(200);sc=await screen();
    assert.ok(!sc.start&&sc.step==='pin'&&sc.num==='123'&&sc.notme,eng+': «Войти» — номер подставлен, виден «Это не я» '+JSON.stringify(sc));
    if(out)await p.screenshot({path:`${out}/${eng}-pin-step.png`});
    // неверный PIN не стирает номер и не входит
    await tapDigits('111111');await wait(900);assert.equal((await screen()).num,'123');assert.equal((await ls()).ev_login_number,'123');
    await tapDigits('246801');await p.locator('.ui2-home-screen').waitFor({timeout:8000});
    assert.deepEqual(logins,['123','123','123'],eng+': вход с запомненным номером');
    // 3) выход из приложения номер не стирает, снова экран PIN
    await p.evaluate(()=>logout());await wait(600);sc=await screen();
    assert.ok(sc.start&&sc.step==='number'&&sc.num===''&&!sc.notme,eng+': c31: после выхода — стартовый экран, не PIN '+JSON.stringify(sc));assert.equal((await ls()).ev_login_number,'123',eng+': номер после выхода остаётся');
    await p.locator('[data-act="loginstart"]').tap();await wait(200);sc=await screen();
    assert.ok(sc.step==='pin'&&sc.num==='123'&&sc.notme,eng+': после выхода «Войти» — PIN с номером '+JSON.stringify(sc));
    assert.ok(!JSON.stringify(await ls()).includes('tok-secret-xyz'));
    // 4) «Это не я»: номер стёрт, экран ввода номера; после перезагрузки — стартовый экран
    await p.locator('[data-act="loginnotme"]').tap();await wait(300);sc=await screen();
    assert.ok(sc.step==='number'&&sc.num===''&&!sc.notme,eng+': «Это не я» — ввод номера заново');assert.equal((await ls()).ev_login_number,undefined,eng+': номер стёрт');
    await p.reload();await wait(600);assert.ok((await screen()).start,eng+': после «Это не я» и перезагрузки — стартовый экран');
    await p.locator('[data-act="loginstart"]').tap();await wait(200);sc=await screen();assert.ok(sc.step==='number'&&sc.num===''&&!sc.notme,eng+': без запомненного номера «Войти» — ввод номера '+JSON.stringify(sc));
    await p.reload();await wait(600);
    // 5) другой номер запоминается заново
    await p.locator('[data-act="loginstart"]').tap();await tapDigits('456');await tapDigits('246801');await p.locator('.ui2-home-screen').waitFor({timeout:8000});assert.equal((await ls()).ev_login_number,'456');
    assert.deepEqual(errs,[],eng+': JS-ошибки '+errs.join('|'));
    await b.close();logins=[];console.log(eng+' PASS');
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
