const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const vm=require('node:vm');
const appSource=require('./app-source.cjs');

const root=path.resolve(__dirname,'..');
const BASE_COMMIT='32f5862f536ba4cfd6a84174aa41321fb59587f1'; // initial 2.0 shell, already proven byte-identical to 1.90 business functions
const html=appSource(root);
const css=fs.readFileSync(path.join(root,'styles','view.css'),'utf8')+fs.readFileSync(path.join(root,'ui2-common.css'),'utf8');
const base=cp.execFileSync('git',['show',BASE_COMMIT+':index.html'],{cwd:root,encoding:'utf8'});

function fn(src,name){
  const start=src.indexOf('function '+name+'(');
  assert.notEqual(start,-1,'missing '+name);
  const open=src.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=open;i<src.length;i++){
    const c=src[i];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

function baseForm(values={}){
  return Object.assign({
    admins:{1:{left:'',came:''}},doctors:{11:{val:'60000'}},others:[],total:'60000',cash:'10000',cashless:'50000',
    ph_val:'',ph_cash:'',ph_cashless:'',open:'0',expenses:[],close:'10000',assistants:{},note:'',
    adv_cash:'',adv_cashless:'',adv_out:'',comp:'',cert:'',nc_comment:'',debt:'',debt_comment:'',repaid:'',
    diff_reason:'',corr_reason:''
  },values);
}

function run(src,form,date='2026-11-15',withUi=false){
  const app=(src.match(/appVer:'([^']+)'/)||[])[1];
  const tol=Number((src.match(/tol:(\d+(?:\.\d+)?),/)||[])[1]);
  const ctx={admins:[{id:1,name:'Администратор'}],doctors:[{id:11,name:'Врач',vm_id:111}],assistants:[],prev:null};
  const nodes={'#money-status':{className:'',innerHTML:''}};
  const prelude=`
    const CFG=${JSON.stringify({appVer:app,tol})};
    const S={view:'form',form:${JSON.stringify(form)},ctx:${JSON.stringify(ctx)},branch:'pereleta',date:${JSON.stringify(date)}};
    const nf=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:2});
    const money=x=>nf.format(Math.round(x*100)/100)+' ₽';
    const r2=x=>Math.round(x*100)/100;
    function num(s){if(s==null)return null;const t=String(s).replace(/[\\s ]/g,'').replace(',','.');if(t==='')return null;if(!/^-?\\d+(\\.\\d{0,2})?$/.test(t))return NaN;return Number(t)}
    const N=s=>{const v=num(s);return(v==null||isNaN(v))?0:v};
    const isRet=a=>a==='Возврат клиника'||a==='Возврат аптека';
    const isNcRet=e=>isRet(e.article)&&e.method==='noncash';
    function updateTransitCheck(){}
    const ruDate=d=>d.split('-').reverse().join('.');
    const aNm=n=>String(n==null?'':n).replace(/\\s+[А-ЯЁ]\\.(?:\\s?[А-ЯЁ]\\.)?$/,'');
    const $=s=>nodes[s]||null;
  `;
  const sandbox={nodes,result:null,Intl,Math,Number,String,Object,Array,JSON,isNaN,isFinite};
  const code=prelude+'\n'+fn(src,'compute')+'\n'+fn(src,'buildData')+(withUi?'\n'+fn(src,'updateChecks'):'')+
    `\nconst calc=compute();${withUi?'updateChecks();':''}result={calc,data:buildData(calc),status:nodes['#money-status']};`;
  vm.runInNewContext(code,sandbox);
  return JSON.parse(JSON.stringify(sandbox.result));
}

assert.match(html,/appVer:'2.0-test-c24'/);
assert.match(html,/name="evrovet-version" content="2.0-test-c24"/);
assert.match(html,/<link rel="stylesheet" href="ui2-common\.css">/);
assert.match(html,/<link rel="stylesheet" href="styles\/view\.css">/);
assert.match(html,/<body class="ui2">/);
assert.match(css,/--ev-accent:#2A7D90/);
assert.match(html,/tol:10,/,'10-ruble tolerance changed');
assert.equal(fn(html,'compute'),fn(base,'compute'),'compute must be byte-identical to 1.90');
assert.equal(fn(html,'buildData').replace(',no_assistant:assistants.length===0&&f.no_assistant===true',''),fn(base,'buildData'),'buildData changed beyond the approved no_assistant flag');
assert.equal(fn(html,'formFromReport').replace('  f.no_assistant=!!d.no_assistant&&!Object.keys(f.assistants).length;\n',''),fn(base,'formFromReport'),'saved report mapping changed beyond the approved no_assistant flag');

const view=fn(html,'viewForm');
const clinicAt=view.indexOf('k-clinic'),advanceAt=view.indexOf('k-adv'),pharmacyAt=view.indexOf('k-pharm');
assert.ok(clinicAt>=0&&advanceAt>clinicAt&&pharmacyAt>advanceAt,'advance block must follow clinic money immediately');
for(const key of ['adv_cash','adv_cashless','adv_out'])assert.equal((view.match(new RegExp("moneyField\\('"+key+"'",'g'))||[]).length,1,key+' must render once');
for(const phrase of ['Новые авансы сегодня','Списано старого аванса','новый аванс укажите дважды'])assert.doesNotMatch(view,new RegExp(phrase,'i'));
for(const phrase of ['Положили на аванс сегодня наличными','Положили на аванс сегодня безналом','Сняли с аванса сегодня','в оплату счетов'])assert.match(view,new RegExp(phrase));
const wording2914=[
  'Клиент дал деньги на аванс — пишем два раза: в наличные или безнал и в «Положили на аванс».',
  'Клиент заплатил авансом — пишем один раз: в «Сняли с аванса». В наличные и безнал ничего.',
  'Когда аванс был внесён — не важно.'
];
for(const phrase of wording2914){
  assert.match(view,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'2914 wording missing from advance block');
  assert.ok((html.split(phrase).length-1)>=5,'2914 wording must be in block, three hints and displayed help');
}

const scenarios=[
  ['без авансов',baseForm()],
  ['положили наличными',baseForm({cash:'20000',cashless:'50000',adv_cash:'10000'})],
  ['положили безналом',baseForm({cash:'10000',cashless:'60000',adv_cashless:'10000'})],
  ['сняли давний аванс при нуле денег',baseForm({doctors:{11:{val:'10000'}},total:'10000',cash:'0',cashless:'0',adv_out:'10000',close:'0'})],
  ['положили и сняли 20000',baseForm({cash:'20000',cashless:'40000',adv_cash:'20000',adv_out:'20000'})],
  ['положили 50000 и сняли 10000',baseForm({cash:'50000',cashless:'50000',adv_cash:'50000',adv_out:'10000',close:'50000'})]
];

for(const [name,form] of scenarios){
  const before=run(base,form),after=run(html,form);
  assert.deepEqual(after.calc,before.calc,name+': checks changed');
  assert.equal(before.data.app,'2.0-test-2922');
  assert.equal(after.data.app,'2.0-test-c24');
  assert.deepEqual(after.data,{...before.data,app:'2.0-test-c24',no_assistant:false},name+': submitted report payload changed beyond exact version marker and approved no_assistant flag');
}

const oldDay=baseForm({cash:'20000',cashless:'50000',adv_cash:'10000'});
assert.deepEqual(run(html,oldDay,'2026-10-28').calc,run(base,oldDay,'2026-10-28').calc,'pre-29.10 calculation changed');

const paidFromAdvance=run(html,baseForm({total:'60000',cash:'50000',cashless:'0',adv_out:'10000',close:'50000'}),'2026-11-15',true).status.innerHTML;
assert.match(paidFromAdvance,/Работы сегодня на 60[\s ]000 ₽/);
assert.match(paidFromAdvance,/Денег пришло 50[\s ]000 ₽/);
assert.match(paidFromAdvance,/Из аванса оплачено 10[\s ]000 ₽/);
assert.match(paidFromAdvance,/Сходится\./);

const placedAdvance=run(html,baseForm({total:'10000',doctors:{11:{val:'10000'}},cash:'50000',cashless:'0',adv_cash:'40000',close:'50000'}),'2026-11-15',true).status.innerHTML;
assert.match(placedAdvance,/Работы сегодня на 10[\s ]000 ₽/);
assert.match(placedAdvance,/Денег пришло 50[\s ]000 ₽/);
assert.match(placedAdvance,/Из них 40[\s ]000 ₽ положили на аванс/);
assert.match(placedAdvance,/Сходится\./);

const mismatch=run(html,baseForm({total:'60000',cash:'58000',cashless:'0',close:'58000'}),'2026-11-15',true).status.innerHTML;
assert.match(mismatch,/Работы сегодня на 60[\s ]000 ₽/);
assert.match(mismatch,/Денег и аванса набралось 58[\s ]000 ₽/);
assert.match(mismatch,/Не хватает 2[\s ]000 ₽/);
assert.match(mismatch,/Проверьте суммы\./);

const helpExpr=html.slice(html.indexOf('/*HELP_START*/const HELP_HTML=')+'/*HELP_START*/const HELP_HTML='.length,html.indexOf(';\n/*HELP_END*/'));
const helpSandbox={result:null};
vm.runInNewContext('const HELP_HTML='+helpExpr+';'+fn(html,'currentHelpHtml')+';result=currentHelpHtml();',helpSandbox);
const help=helpSandbox.result;
for(const phrase of ['старый аванс','новый аванс','укажите дважды','Наличный аванс лежит в кассе'])assert.doesNotMatch(help,new RegExp(phrase,'i'));
assert.match(help,/разница до 10 рублей включительно/);
assert.match(help,/В вал клиники входят все услуги за день, в том числе оплаченные с аванса\. Деньги, положенные на аванс, в вал не входят\./);

const greeting=fn(html,'stageGreetingWord');
const greetingSandbox={result:null};
vm.runInNewContext(greeting+`;result=[stageGreetingWord(5),stageGreetingWord(11),stageGreetingWord(12),stageGreetingWord(16),stageGreetingWord(17),stageGreetingWord(22),stageGreetingWord(23),stageGreetingWord(4)]`,greetingSandbox);
assert.deepEqual(Array.from(greetingSandbox.result),['Доброе утро','Доброе утро','Добрый день','Добрый день','Добрый вечер','Добрый вечер','Здравствуйте','Здравствуйте']);
const productionRef=['ikxmzapf','mgqnnrsttuxc'].join('');
assert.equal(html.includes(productionRef),false,'production project must not be referenced');
assert.match(html,/txcibtcfuzqhhebeguby/,'test project missing');
assert.doesNotMatch(html,/Денежные расчёты работают так же, как в версии 1\.90/,'service copy must not be visible');
for(const phrase of ['Личный номер — 3 цифры','PIN — 6 цифр','Номер и PIN — ваша подпись. Никому не передавайте','Автоматический выход через 30 минут'])assert.match(html,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'login copy missing: '+phrase);
assert.match(css,/animation:ev-breathe 3\.2s/,'logo pulse must use the approved 3.2 second timing');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'reduced motion guard missing');
const rolesFn=fn(html,'personRoles');
assert.doesNotMatch(rolesFn,/!roles\.size/,'missing roles must not default to admin or doctor');
assert.match(html,/case'prepare'/,'future tiles must open the preparation screen');
assert.match(fn(html,'prepareHtml'),/Раздел готовится/,'preparation screen title missing');

const periodSandbox={result:null,Date,Number,String,Array};
vm.runInNewContext(`
  ${fn(html,'muEligiblePeriods')}
  ${fn(html,'muDefaultPeriod')}
  const oct={from:'2026-10-16',to:'2026-10-31'};
  const nov={from:'2026-11-01',to:'2026-11-15'};
  result={
    d1311:muDefaultPeriod('2026-11-13',[nov]),
    d2910:muDefaultPeriod('2026-10-29',[oct,nov]),
    d0211:muDefaultPeriod('2026-11-02',[oct,nov]),
    twoOpen:muEligiblePeriods('2026-11-13',[nov,oct]),
    pastIssued:muEligiblePeriods('2026-11-13',[nov]),
    futureExcluded:muEligiblePeriods('2026-10-29',[nov,oct])
  };
`,periodSandbox);
assert.deepEqual(Array.from(periodSandbox.result.d1311),['2026-11-01','2026-11-15']);
assert.deepEqual(Array.from(periodSandbox.result.d2910),['2026-10-16','2026-10-31']);
assert.deepEqual(Array.from(periodSandbox.result.d0211),['2026-10-16','2026-10-31']);
assert.deepEqual(Array.from(periodSandbox.result.twoOpen,x=>Array.from(x)),[['2026-10-16','2026-10-31'],['2026-11-01','2026-11-15']],'earliest open period must be first');
assert.deepEqual(Array.from(periodSandbox.result.pastIssued,x=>Array.from(x)),[['2026-11-01','2026-11-15']],'issued period must be absent');
assert.deepEqual(Array.from(periodSandbox.result.futureExcluded,x=>Array.from(x)),[['2026-10-16','2026-10-31']],'periods starting after payment date must be absent');
const payrollPeriodSandbox={result:null,Date,Number,String,Array};
vm.runInNewContext(`
  const PAY_START='2026-10-16';
  const addDays=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const perStart=d=>Number(d.slice(8))<=15?d.slice(0,8)+'01':d.slice(0,8)+'16';
  const perEnd=d=>Number(d.slice(8))<=15?d.slice(0,8)+'15':new Date(Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7)),0)).toISOString().slice(0,10);
  ${fn(html,'muEligiblePeriods')}
  ${fn(html,'muDefaultPeriod')}
  ${fn(html,'payrollDefaultPeriod')}
  const nov={from:'2026-11-01',to:'2026-11-15'};
  result={unissued:payrollDefaultPeriod('2026-11-16',[nov]),issued:payrollDefaultPeriod('2026-11-16',[])};
`,payrollPeriodSandbox);
assert.deepEqual(Array.from(payrollPeriodSandbox.result.unissued),['2026-11-01','2026-11-15'],'16 Nov must open the first unissued 1–15 period');
assert.deepEqual(Array.from(payrollPeriodSandbox.result.issued),['2026-11-16','2026-11-30'],'after 1–15 is issued, 16–30 must open');
assert.match(fn(html,'showPay'),/rpc\('ev_mu_batches'/,'payroll default must use the same server period list as bank upload');
assert.match(fn(html,'payHtml'),/Зарплата за/);
assert.match(fn(html,'payHtml'),/‹ прошлый/);
assert.match(fn(html,'payHtml'),/следующий ›/);
const allRowsSandbox={result:null,String,Set,Array};
vm.runInNewContext(`
  ${fn(html,'payrollAllRows')}
  const rows=Array.from({length:8},(_,i)=>({id:i+1,name:'Сотрудник '+(i+1)}));
  const doctors=Array.from({length:9},(_,i)=>({id:i+1,name:'Врач '+(i+1)}));
  result={count:payrollAllRows(rows,doctors).length,ids:payrollAllRows(rows,doctors).map(x=>x.id)};
`,allRowsSandbox);
assert.equal(allRowsSandbox.result.count,9,'All count must include every unique doctor shown by the doctor filter');
assert.deepEqual(Array.from(allRowsSandbox.result.ids),[1,2,3,4,5,6,7,8,9],'All rows must be a unique union, not a sum of group counts');
const payHtmlSource=fn(html,'payHtml');
assert.match(payHtmlSource,/\+ Такси, доплата или вычет/);
assert.ok(payHtmlSource.indexOf('+ Такси, доплата или вычет')<payHtmlSource.indexOf('По сотрудникам'),'adjustment action must be above the employee list');
assert.match(html,/period_issued:'Период уже выдан\. Выберите другой'/);
assert.match(html,/period_not_ready:'Для периода ещё не загружены начисления трёх филиалов'/);
assert.match(html,/period_future:'Период начинается позже даты платежа\. Выберите другой'/);
assert.match(html,/Если их несколько, сначала выбран самый ранний\. Перед загрузкой обязательно проверьте и подтвердите период/);
assert.match(html,/Подтвердить и загрузить выплаты/);
assert.match(fn(html,'muHtml'),/Уже выданные периоды в списке не показываются/);
assert.match(html,/t\.id==='mubper'.*S\.mu\.bank\.period=t\.value\.split\('\|'\)/s,'period selector must update the large confirmed period');

for(const name of ['safeBody','pplCard','payCloseForm','payAddForm']){
  const source=fn(html,name);
  for(const phrase of ['на карту','картой','наличными','в конверте'])assert.doesNotMatch(source,new RegExp(phrase,'i'),name+' contains forbidden salary wording: '+phrase);
}
assert.match(fn(html,'safeBody'),/Начислено/);
assert.match(fn(html,'safeBody'),/Выплачено/);
assert.match(fn(html,'safeBody'),/Остаток к выплате/);
assert.match(fn(html,'payAddForm'),/Выплаты из реестра банка загружаются отдельно\. Здесь — прочие выплаты/);

assert.match(html,/const moneyField=.*hk\?hbtn\(hk\)/,'money fields lost their help buttons');
assert.match(html,/marksa:\['Маркса, 45','Маркса','Марк\.'\]/,'calendar must use the approved Marksa abbreviation');
assert.match(html,/'70let':\['70 лет Октября, 20','70 лет','70 л\.'\]/,'calendar must use the approved 70 let abbreviation');
assert.match(html,/pereleta:\['Перелёта, 19','Перелёта','Перел\.'\]/,'calendar must use the approved Pereleta abbreviation');
assert.match(html,/SCH_B\[ks\[0\]\]\[2\]/,'my-shift calendar must render the short branch label');
assert.match(css,/\.cal \.d\.f small\{font-size:10px/,'calendar branch labels must be 10px');
assert.match(fn(html,'setHeader'),/h\.className=S\.view==='form'\?'form-head':''/,'report header must have a narrow-screen layout hook');
assert.doesNotMatch(fn(html,'setHeader'),/ · Мой ЕВРОВЕТ/,'header role must not be clipped by a duplicate app name');
const keydown=html.slice(html.indexOf("document.addEventListener('keydown'"),html.indexOf("document.addEventListener('pointerdown'"));
assert.match(keydown,/fields\.indexOf\(t\)\+1/,'Enter must move to the next report field');
assert.doesNotMatch(keydown,/submit\s*\(/,'Enter must never submit a report');

const handoverSandbox={
  S:{branch:'pereleta',date:'2026-11-15',person:{name:'Смирнова А. С.'}},CFG:{tol:10},
  result:null,Number,isFinite,Date,
  handoverHere:()=>({loading:false,offline:false,error:null,ctx:{ok:true,mode:'shadow',expected:29900,source:null,current:null,can_accept:true}}),
  handoverPending:()=>null,money:x=>String(x)+' ₽',ruDate:x=>String(x),esc:x=>String(x)
};
vm.runInNewContext(fn(html,'handoverHtml')+';result=handoverHtml();',handoverSandbox);
assert.match(handoverSandbox.result,/Нет подтверждённого предыдущего отчёта/);
assert.doesNotMatch(handoverSandbox.result,/NaN/);

const openingSandbox={S:{ctx:{current:null}},result:null,Number,isFinite,r2:x=>Math.round(x*100)/100,isHead:()=>false,handoverHere:()=>({ctx:{current:{}}}),handoverOpening:()=>null};
vm.runInNewContext(fn(html,'openingState')+';result=openingState();',openingSandbox);
assert.deepEqual(JSON.parse(JSON.stringify(openingSandbox.result)),{mode:'waiting'},'missing actual must stay a numberless waiting state');
assert.match(fn(html,'viewForm'),/const known=op\.actual!=null&&isFinite\(Number\(op\.actual\)\)/,'waiting UI must guard the expected amount');

assert.match(css,/@media\(max-width:340px\)\{\.money-field\{grid-template-columns:1fr\}/,'320px fields must stack');
console.log('release 2.0 test: OK (6/6 advance scenarios, handover guards, Enter navigation, greeting, isolation)');
