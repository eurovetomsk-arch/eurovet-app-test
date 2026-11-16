'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const appSource=require('./app-source.cjs');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const report=read('scripts/report.js'),view=read('scripts/view.js'),acc=read('scripts/accruals.js'),home=read('scripts/home.js'),sql=read('test-db-3368.sql');
function fn(src,name){const start=src.indexOf('function '+name+'(');assert.notEqual(start,-1,'missing '+name);const open=src.indexOf('{',start);let depth=0,quote='',escaped=false;for(let i=open;i<src.length;i++){const c=src[i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1)}throw new Error('unterminated '+name)}

for(const x of ['ev_collection_handoff','ev_collection_pickup','ev_collection_transit_list','ev_collection_reconcile_report','ev_safe_out_add_v2','ev_my_cash_today'])assert.match(sql,new RegExp(x));
for(const x of ['enable row level security','revoke all on table public.ev_collection_transit','source text not null','status text not null','client_uid text not null unique'])assert.ok(sql.toLowerCase().includes(x));
assert.match(sql,/abs\(v_expected-v_declared\)<=10/);
assert.match(report,/Сумму в расходе введите сами/);
assert.match(report,/function updateTransitCheck/);
assert.match(view,/data-source="admin"/);assert.match(view,/data-source="head"/);
assert.match(acc,/Мои деньги сегодня/);assert.match(acc,/cash_payroll/);assert.match(acc,/p_purpose:p/);
assert.match(home,/Забрал с филиала/);assert.match(home,/Взял из сейфа/);
const liveReport=appSource(path.join(root,'..','eurovet-app'));
assert.equal(fn(report,'compute'),fn(liveReport,'compute'),'compute money logic changed');
assert.equal(fn(report,'validate'),fn(liveReport,'validate'),'validate money logic changed');
assert.ok(!sql.includes('ikxmzapfmgqnnrsttuxc'),'production project id leaked into test migration');
console.log('PASS collection-transit-3368');
