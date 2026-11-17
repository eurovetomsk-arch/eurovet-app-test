'use strict';
/* Отпускные (12а, клиент): тип файла, путь загрузки, отмена, строки в карточке и «Мои начисления». rpc подменён. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','scripts','accruals.js'),'utf8');
const a=src.indexOf('const VAC={'),b=src.indexOf('function muHtml(){',a);
const vacCode=src.slice(a,b);
const lb=src.indexOf('async function muLoadVacation(){'),le=src.indexOf('async function muLoadBank(){',lb);
const loadCode=src.slice(lb,le);
assert.ok(vacCode.length>200&&loadCode.length>200);
const calls=[];
const ctx={S:{token:'t',view:'mu',mu:{bankKind:'vacation',busy:false,bank:{hash:'h'.repeat(64),rows:[{person_id:2,amount:5000,date:'2026-11-05'},{person_id:3,amount:3000,date:'2026-11-05'},{err:'нет в списке',fio:'Чужой Ч.',amount:1}]}}},
  rpc:async(n,x)=>{calls.push([n,x]);return n==='ev_mu_load_vacation'?{ok:true,rows:x.p_rows.length,total:8000}:{ok:true,items:[{id:1,person:2,date:'2026-11-05',amount:5000},{id:2,person:3,date:'2026-11-05',amount:3000}],total:8000,loads:[{hash:'h',rows:2,total:8000,date:'2026-11-05',cancelled:false}]}},
  paint(){},confirm:()=>true,muR2:v=>Math.round(v*100)/100,muF:v=>String(v),muReloadBatches:async()=>{},money:v=>v+' ₽',ruDate:s=>s,esc:s=>String(s),MU_ERR:{},toast(){},addDays:(d)=>d,omskToday:()=>'2026-11-17',
  muHtmlUnused:null};
vm.createContext(ctx);vm.runInContext(vacCode+loadCode+';this.muLoadVacation=muLoadVacation;this.vacPersonHtml=vacPersonHtml;this.loadVacation=loadVacation;this.VAC=VAC;this.vacPeriodLine=vacPeriodLine;',ctx);
(async()=>{
  await ctx.muLoadVacation();
  const c=calls.find(x=>x[0]==='ev_mu_load_vacation');assert.ok(c,'вызвана ev_mu_load_vacation');
  assert.equal(c[1].p_rows.length,2,'строка с ошибкой не уходит');assert.deepEqual(Object.keys(c[1].p_rows[0]).sort(),['amount','date','person_id']);
  assert.equal(calls.some(x=>x[0]==='ev_mu_load_bank'||x[0]==='ev_payroll_paid_load'),false,'путь зарплаты не задет');
  assert.match(ctx.S.mu.bank.done,/Отпускные загружены/);
  await ctx.loadVacation('2026-11-01','2026-11-15',true);
  assert.match(ctx.vacPersonHtml(2),/Отпускные · 2026-11-05[\s\S]*не вычитаются из зарплаты[\s\S]*5000/);
  assert.equal(ctx.vacPersonHtml(99),'');
  assert.match(ctx.vacPeriodLine({from:'2026-11-01',to:'2026-11-15'}),/не входит в «Выплачено»[\s\S]*8000/);
  // без даты — загрузка не уходит
  calls.length=0;ctx.S.mu.bank.rows=[{person_id:2,amount:5000,date:null}];await ctx.muLoadVacation();assert.equal(calls.length,0);
  console.log('vacation c11: OK (тип файла, путь отпускных отдельно от зарплаты, строка в карточке, итог периода)');
})().catch(e=>{console.error(e);process.exit(1)});
