'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const appSource=require('./app-source.cjs');
const root=path.resolve(__dirname,'..');
const live=appSource(path.join(root,'..','eurovet-app'));
const test=appSource(root);
const fixturePath=process.argv[2];
if(!fixturePath)throw new Error('fixture path required');
const rows=JSON.parse(fs.readFileSync(fixturePath,'utf8'));

function fn(src,name){const s=src.indexOf('function '+name+'(');assert.notEqual(s,-1,'missing '+name);const o=src.indexOf('{',s);let d=0,q='',e=false;for(let i=o;i<src.length;i++){const c=src[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c===q)q='';continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;else if(c==='}'&&--d===0)return src.slice(s,i+1)}throw new Error('unterminated '+name)}
assert.equal(fn(test,'compute'),fn(live,'compute'),'compute differs between 1.91 and 2.0');
assert.equal(fn(test,'validate'),fn(live,'validate'),'validate differs between 1.91 and 2.0');

function run(src,x){
  const f={admins:{1:{left:'',came:''}},doctors:{},others:[],total:x.total,cash:x.cash,cashless:x.cashless,ph_val:x.ph_val,ph_cash:x.ph_cash,ph_cashless:x.ph_cashless,open:x.open,expenses:x.expenses||[],close:x.close,assistants:{},note:'',adv_cash:x.adv_cash,adv_cashless:x.adv_cashless,adv_out:x.adv_out,comp:0,cert:0,nc_comment:'',debt:x.debt,debt_comment:'',repaid:x.repaid,diff_reason:'',corr_reason:''};
  (x.doctors||[]).forEach((v,i)=>{f.doctors[String(i+1)]={val:v}});
  const doctors=(x.doctors||[]).map((v,i)=>({id:i+1,name:'D'+(i+1)}));
  const code=`const S={form:${JSON.stringify(f)},ctx:{doctors:${JSON.stringify(doctors)},admins:[{id:1}],assistants:[],prev:null},date:${JSON.stringify(x.date)}};const CFG={tol:10};const r2=x=>Math.round(x*100)/100;const money=x=>String(r2(Number(x||0)))+' ₽';function num(s){if(s==null)return null;const t=String(s).replace(/[\\s ]/g,'').replace(',','.');if(t==='')return null;if(!/^-?\\d+(\\.\\d{0,2})?$/.test(t))return NaN;return Number(t)}const N=s=>{const v=num(s);return(v==null||isNaN(v))?0:v};const isRet=a=>a==='Возврат клиника'||a==='Возврат аптека';const isNcRet=e=>isRet(e.article)&&e.method==='noncash';${fn(src,'compute')};result=compute();`;
  const box={result:null,Math,Number,String,Object,Array,JSON,isNaN};vm.runInNewContext(code,box);return JSON.parse(JSON.stringify(box.result));
}
for(const x of rows)assert.deepEqual(run(test,x),run(live,x),x.branch+' '+x.date);
console.log('PASS dual-run-3364 '+rows.length+' reports; zero calculation differences');
