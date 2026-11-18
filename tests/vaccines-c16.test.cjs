/* c16 (REMARKS п.24а–д): модуль «Вакцины» — красное «мало» видно всем ролям, внесение только у админа/руководителя, сохранение шлёт 9 позиций. Touch 375. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.EVROVET_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Omsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const P={
  head:{id:1,full_name:'Соколова Анна Сергеевна',short_name:'Соколова А.С.',head:true,roles:['head']},
  admin:{id:16,full_name:'Фёдорова Татьяна Владимировна',short_name:'Фёдорова Т.В.',admin:true,roles:['admin']},
  doctor:{id:2,full_name:'Орлов Илья Петрович',short_name:'Орлов И.П.',work:true,doctor:true,roles:['doctor']},
  assistant:{id:11,full_name:'Семёнова Алина Романовна',short_name:'Семёнова А.Р.',work:true,assistant_clinical:true,roles:['assistant_clinical']},
  callcenter:{id:32,full_name:'Макарова Алёна Викторовна',short_name:'Макарова А.В.',cc:true,roles:['callcenter']},
  courier:{id:35,full_name:'Ильин Григорий Борисович',short_name:'Ильин Г.Б.',work:true,cour:true,roles:['courier']}
};
const ITEMS=[[1,'Биокан DHPPi+LR','Биокан',1,5],[2,'Биокан DHPPi+L','Биокан',1,5],[3,'Мультикан-6','Мультикан',2,5],[4,'Мультикан-8','Мультикан',2,5],[5,'Мультифел-4','Мультифел',3,5],[6,'Рабифел','Рабифел и Рабикс (бешенство)',4,5],[7,'Рабикс','Рабифел и Рабикс (бешенство)',4,5],[8,'Вакцины для кроликов','Кролики',5,null],[9,'Чипы','Чипы',6,3]].map(x=>({id:x[0],name:x[1],grp:x[2],grp_sort:x[3],min:x[4]}));
let saved=null;
function body(name,a,person){
  switch(name){
    case'ev_login_number':return{ok:true,token:'t',person};
    case'ev_vaccines_overview':return{ok:true,today,items:ITEMS,low_total:2,missing_today:['70let'],branches:[
      {branch:'70let',title:'70 лет Октября, 20',stock_date:null,entered_at:null,by:null,qty:{},low:[]},
      {branch:'marksa',title:'Маркса, 45',stock_date:today,entered_at:today+'T10:00:00Z',by:'Куклина Л.В.',qty:{1:15,2:7,3:0,4:11,5:7,6:9,7:5,8:0,9:6},low:[3]},
      {branch:'pereleta',title:'Перелёта, 19',stock_date:today,entered_at:today+'T10:05:00Z',by:'Фёдорова Т.В.',qty:{1:8,2:6,3:6,4:9,5:5,6:7,7:5,8:1,9:2},low:[9]}]};
    case'ev_vaccines_save':saved=a;return{ok:true,saved:9,entered_at:new Date().toISOString()};
    case'ev_vaccines_history':return{ok:true,days:[]};
    case'ev_day_status':return{ok:true,date:today,branches:[]};
    case'ev_cc_today':return{ok:true,date:today,me:false,ops:0,others:[]};
    default:return{ok:true,rows:[],items:[],shifts:[],branches:[]};
  }
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.resolve(root,rel);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404).end();return}s.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s)});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(o=>server.listen(0,'127.0.0.1',o));const url='http://127.0.0.1:'+server.address().port+'/';
  for(const eng of (process.env.ENGINES||'chromium').split(',')){
    const b=await pw[eng].launch();
    for(const role of Object.keys(P)){
      const c=await b.newContext({viewport:{width:375,height:1700},hasTouch:true,isMobile:true});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
      await p.route('**/rest/v1/rpc/**',async r=>{const n=r.request().url().split('/').pop();let a={};try{a=JSON.parse(r.request().postData()||'{}')}catch(e){}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body(n,a,P[role]))})});
      await p.goto(url);await wait(300);await p.locator('[data-act="loginstart"]').tap();for(const n of '123123456')await p.locator(`[data-act="logindigit"][data-n="${n}"]`).tap();
      await p.locator('.ui2-home-screen').waitFor({timeout:8000});await wait(1200);
      const tile=p.locator('.ui2-role-tile[data-v="vac"]').first();
      assert.equal(await tile.count(),1,eng+' '+role+': нет плитки «Вакцины»');
      assert.match(await tile.innerText(),/мало: 2/,eng+' '+role+': нет красной метки «мало: 2»');
      await tile.tap();await wait(800);
      let t=await p.evaluate(()=>document.getElementById('app').innerText);
      assert.match(t,/Ниже нормы: 2/,eng+' '+role+': нет карточки «Ниже нормы»');
      await p.locator('[data-act="vacbranch"][data-id="marksa"]').tap();await wait(300);
      assert.equal(await p.locator('.vac-row.low').count(),1,eng+' '+role+': красных строк у Маркса должно быть 1');
      assert.equal(await p.locator('.vac-row.low em').first().innerText(),'мало');
      const canEnter=role==='admin'||role==='head';
      assert.equal(await p.locator('[data-act="vacentry"]').count(),canEnter?1:0,eng+' '+role+': кнопка «Внести остатки» '+(canEnter?'нужна':'не должна показываться'));
      if(role==='admin'){
        await p.locator('[data-act="vacentry"]').tap();await wait(400);
        assert.equal(await p.locator('.vq').count(),9,'9 позиций ввода');
        assert.equal(await p.locator('.vq[data-id="3"]').inputValue(),'0','подставлено прошлое значение');
        await p.locator('.vac-b[data-id="3"][data-s="1"]').tap();await p.locator('.vac-b[data-id="3"][data-s="1"]').tap();
        assert.equal(await p.locator('.vq[data-id="3"]').inputValue(),'2');
        await p.locator('.vq[data-id="9"]').fill('7');
        await p.locator('[data-act="vacsave"]').tap();await wait(900);
        assert.ok(saved&&saved.p_branch==='marksa'&&saved.p_rows.length===9,'save: филиал и 9 строк');
        assert.equal(saved.p_rows.find(x=>x.item_id===3).qty,2);assert.equal(saved.p_rows.find(x=>x.item_id===9).qty,7);
        assert.match(await p.evaluate(()=>document.getElementById('app').innerText),/Остатки внесены в \d\d:\d\d/);
      }
      assert.equal(errs.length,0,eng+' '+role+': ошибка скрипта '+errs[0]);
      await c.close();
    }
    await b.close();
  }
  server.close();console.log('vaccines c16: OK (6 ролей: плитка с «мало», красные строки, внесение только админ/руководитель, сохранение 9 позиций)');
})().catch(e=>{console.error(e);process.exit(1)});
