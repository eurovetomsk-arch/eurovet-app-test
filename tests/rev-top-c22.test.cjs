/* c22: «Выручка» руководителя — итог дня наверху крупной карточкой, кнопки периода одной строкой с прокруткой.
   Числа считаются независимо из мока (не из экрана); ACC_OLD=<путь> подставляет старый accruals.js для сравнения «до/после». Мок ответов сервера. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const out=process.env.SHOTS?path.resolve(process.env.SHOTS):null;if(out)fs.mkdirSync(out,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const head={id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,roles:['head']};
const rep=(b,total,pv)=>({branch:b,date:today,total,cash:total/2,cashless:total/2,pharm_val:pv,pharm_cash:pv/2,pharm_cashless:pv/2,debt:0,repaid:0,doctors:[]});
const reports=[rep('marksa',100000,20000),rep('70let',50000,10000),rep('pereleta',30000,5000)];
const rates={admin_shift:2500,admin_pharmacy_pct:0.05,fix_normal:100,fix_xray:200};
const sal={ok:true,rates,admins:[{id:11,name:'Админ А',days:[{branch:'marksa',date:today,late_hours:0,pharm:20000},{branch:'70let',date:today,late_hours:0,pharm:10000}]}],assistants:[{id:21,name:'Ассистент Б',days:[{branch:'pereleta',date:today,rate:1500,fix_normal:2,fix_xray:1}]}]};
const exp={clinic:180000,pharm:35000,all:215000,sal:(2500+20000*.05)+(2500+10000*.05)+(1500+200+200)};
function body(n){switch(n){
  case'ev_login_number':return{ok:true,token:'t',person:head};
  case'ev_revenue':return{ok:true,reports,debt_open:{}};
  case'ev_salary':return sal;
  case'ev_flags_pending':return{ok:true,from:'2026-10-27',to:today,pending:[],accepted:[],coverage:[],yellow_count:0,red_count:0};
  case'ev_cash_on_hand':return{ok:false,error:'mock'};
  case'ev_day_status':return{ok:true,date:today,branches:[]};
  default:return{ok:true,rows:[],items:[],shifts:[],branches:[]};}}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const num=t=>Number(String(t).replace(/[^\d,-]/g,'').replace(',','.'));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  const sizes=[[375,900],[768,1000],[1280,900]];
  for(const eng of (process.env.ENGINES||'chromium').split(',')){
    const b=await pw[eng].launch();
    for(const [w,h] of sizes){
      const c=await b.newContext({viewport:{width:w,height:h},hasTouch:w<500,isMobile:w<500});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      let rpcs=0;
      await p.route('**/rest/v1/rpc/**',r=>{rpcs++;const n=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(n))})});
      if(process.env.ACC_OLD)await p.route('**/scripts/accruals.js',r=>r.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:fs.readFileSync(process.env.ACC_OLD,'utf8')}));
      await p.goto(url);await wait(300);
      const tap=async l=>w<500?l.tap():l.click();
      await tap(p.locator('[data-act="loginstart"]'));for(const n of '123123456')await tap(p.locator(`[data-act="logindigit"][data-n="${n}"]`));
      await p.locator('.ui2-home-screen').waitFor({timeout:8000});await wait(600);
      await tap(p.locator('[data-v="rev"]').first());await wait(1800);
      const t=await p.evaluate(()=>document.getElementById('app').innerText);
      // числа: «Всего», клиника/аптека/зарплата итога и строки филиалов
      const lines=await p.evaluate(()=>[...document.querySelectorAll('#app .srow')].map(e=>e.innerText.replace(/\s+/g,' ').trim()));
      const vals=l=>lines.filter(x=>x.startsWith(l)).map(num);
      assert.deepEqual(vals('Всего'),[exp.all],eng+w+': Всего');
      assert.deepEqual(vals('клиника'),[exp.clinic],eng+w+': клиника итог');
      assert.deepEqual(vals('аптека'),[exp.pharm],eng+w+': аптека итог');
      assert.deepEqual(vals('зарплата по сменам'),[exp.sal],eng+w+': зарплата итог');
      assert.deepEqual(vals('Клиника ').sort((a,b)=>a-b),[30000,50000,100000],eng+w+': строки филиалов, клиника');
      assert.deepEqual(vals('Аптека ').sort((a,b)=>a-b),[5000,10000,20000],eng+w+': строки филиалов, аптека');
      if(process.env.ACC_OLD){console.log(JSON.stringify(lines));}
      else{
        // порядок: итог раньше карточки «Все филиалы»; период внутри карточки итога; кнопки периода — одна строка
        const geo=await p.evaluate(()=>{const top=document.querySelector('.card.revtop'),br=[...document.querySelectorAll('#app .card h2')].find(e=>e.textContent==='Все филиалы'),fl=document.querySelector('.chips.rvper');
          const chips=[...fl.querySelectorAll('.chip')];const ys=new Set(chips.map(c=>Math.round(c.getBoundingClientRect().top)));
          return{topY:top.getBoundingClientRect().top,brY:br.getBoundingClientRect().top,perIn:!!top.querySelector('.revtop-per')&&/\d{4}/.test(top.querySelector('.revtop-per').textContent),grayLine:[...document.querySelectorAll('#app p.hint')].some(e=>/^\d{1,2} \S+ \d{4}$/.test(e.textContent.trim())),rows:ys.size,scrollW:fl.scrollWidth,clientW:fl.clientWidth,fits:chips.length,overflowX:getComputedStyle(fl).overflowX}});
        assert.ok(geo.topY<geo.brY,eng+w+': итог выше карточек филиалов');
        assert.ok(geo.perIn,eng+w+': период внутри карточки итога');
        assert.equal(geo.rows,1,eng+w+': кнопки периода в одну строку');
        assert.equal(geo.overflowX,'auto');
        if(w===375)assert.ok(geo.scrollW>geo.clientW,eng+': на 375 кнопки прокручиваются ('+geo.scrollW+'>'+geo.clientW+')');
        // прокрутка до «Даты»
        if(w===375){await p.evaluate(()=>{const f=document.querySelector('.chips.rvper');f.scrollLeft=f.scrollWidth});await wait(300);
          const sc=await p.evaluate(()=>document.querySelector('.chips.rvper').scrollLeft);assert.ok(sc>0,eng+': прокрутка сработала');
          const vis=await p.evaluate(()=>{const f=document.querySelector('.chips.rvper').getBoundingClientRect(),l=[...document.querySelectorAll('.chips.rvper .chip')].pop().getBoundingClientRect();return l.right<=f.right+1&&l.left>=f.left});assert.ok(vis,eng+': «Даты» видна после прокрутки');
          if(out)await p.screenshot({path:`${out}/${eng}-${w}-scrolled.png`});await p.evaluate(()=>{document.querySelector('.chips.rvper').scrollLeft=0});await wait(200)}
        // выбор «Вчера» не ломает порядок
        await tap(p.locator('[data-act="revper"]').nth(1));await wait(1200);
        assert.equal(await p.locator('.card.revtop').count(),1,eng+w+': после «Вчера» карточка итога есть');
      }
      assert.deepEqual(errs,[],eng+w+': JS-ошибки '+errs.join('|'));
      if(out)await p.screenshot({path:`${out}/${eng}-${w}${process.env.ACC_OLD?'-before':'-after'}.png`,fullPage:true});
      await c.close();
    }
    await b.close();console.log(eng+' PASS');
  }
  server.close();
})().catch(e=>{console.error(e);process.exit(1)});
