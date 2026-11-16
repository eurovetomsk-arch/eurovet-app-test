'use strict';
/* Эталон кассы: ожидаемый остаток кассы, который 1.92 сохранила в каждом отчёте (data.cashbox.expected_closing),
   пересчитывается compute() 2.0. Фикстура с суммами — НЕ в репозитории: передаётся путём (у Стройки: _local/golden/fixture_reports_20261116.json). */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const appSource=require('./app-source.cjs');
const root=path.resolve(__dirname,'..');
const test=appSource(root);
const fixturePath=process.argv[2];
if(!fixturePath)throw new Error('fixture path required');
const rows=JSON.parse(fs.readFileSync(fixturePath,'utf8'));

function fn(src,name){const s=src.indexOf('function '+name+'(');assert.notEqual(s,-1,'missing '+name);const o=src.indexOf('{',s);let d=0,q='',e=false;for(let i=o;i<src.length;i++){const c=src[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c===q)q='';continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return src.slice(s,i+1)}throw new Error('unterminated '+name)}

function run(src,x){
  const f={admins:{1:{left:'',came:''}},doctors:{},others:x.others||[],total:x.total,cash:x.cash,cashless:x.cashless,ph_val:x.ph_val,ph_cash:x.ph_cash,ph_cashless:x.ph_cashless,open:x.open,expenses:x.expenses||[],close:x.close,assistants:{},note:'',adv_cash:x.adv_cash,adv_cashless:x.adv_cashless,adv_out:x.adv_out,comp:x.comp||0,cert:x.cert||0,nc_comment:'',debt:x.debt,debt_comment:'',repaid:x.repaid,diff_reason:'',corr_reason:''};
  (x.doctors||[]).forEach((v,i)=>{f.doctors[String(i+1)]={val:v}});
  const doctors=(x.doctors||[]).map((v,i)=>({id:i+1,name:'D'+(i+1)}));
  const code=`const S={form:${JSON.stringify(f)},ctx:{doctors:${JSON.stringify(doctors)},admins:[{id:1}],assistants:[],prev:null},date:${JSON.stringify(x.date)}};const CFG={tol:10};const r2=x=>Math.round(x*100)/100;const money=x=>String(r2(Number(x||0)))+' ₽';function num(s){if(s==null)return null;const t=String(s).replace(/[\\s ]/g,'').replace(',','.');if(t==='')return null;if(!/^-?\\d+(\\.\\d{0,2})?$/.test(t))return NaN;return Number(t)}const N=s=>{const v=num(s);return(v==null||isNaN(v))?0:v};const isRet=a=>a==='Возврат клиника'||a==='Возврат аптека';const isNcRet=e=>isRet(e.article)&&e.method==='noncash';${fn(src,'compute')};result=compute();`;
  const box={result:null,Math,Number,String,Object,Array,JSON,isNaN};vm.runInNewContext(code,box);return JSON.parse(JSON.stringify(box.result));
}
/* Три отчёта сданы старыми версиями приложения (1.47, 1.56), тогда формула кассы была другой. compute() 1.92 и 2.0
   на них совпадают между собой (dual-run-3364), расходятся только с числом, сохранённым старой версией. Список закрыт: новое расхождение = FAIL. */
const HISTORIC=new Set(['marksa|2026-10-22|3|1.47','pereleta|2026-10-31|2|1.56','pereleta|2026-10-31|4|1.56']);
let bad=0,n=0,hist=0;
for(const x of rows){if(x.expected_closing==null||x.expected_closing==='')continue;n++;const r=run(test,x);
  if(Math.round(Number(r.expected)*100)!==Math.round(Number(x.expected_closing)*100)){if(HISTORIC.has([x.branch,x.date,x.version,x.app].join('|'))){hist++;continue}bad++;console.log('DIFF',x.branch,x.date,'v'+x.version,'app',x.app,'2.0',r.expected,'1.92',x.expected_closing)}}
assert.equal(bad,0,'cash expected closing differs');
console.log('PASS golden-cash '+n+' reports ('+hist+' исторических версии 1.47/1.56 по списку): compute() 2.0 = ожидаемый остаток кассы, сохранённый 1.92');
