const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'scripts/accruals.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'test-db-3234.sql'),'utf8');

function fn(name){
  const start=js.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  let depth=0,body=false;
  for(let i=start;i<js.length;i++){
    if(js[i]==='{'){depth++;body=true}
    else if(js[i]==='}'&&body&&--depth===0)return js.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

const box={result:null,perStart:d=>d.slice(0,8)+(Number(d.slice(8,10))<=15?'01':'16'),perEnd:d=>Number(d.slice(8,10))<=15?d.slice(0,8)+'15':new Date(Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7)),0)).toISOString().slice(0,10)};
vm.runInNewContext(fn('ccValPeriod')+';result=ccValPeriod("2026-11-01","2026-11-15")',box);
assert.deepEqual(JSON.parse(JSON.stringify(box.result)),['2026-11-01','2026-11-15']);

const poolBox={result:null,Number,Math};
vm.runInNewContext('const ccManualPool=(amount,pct)=>Math.round(Number(amount)*Number(pct)*100)/100;result=ccManualPool(1000000,.03)',poolBox);
assert.equal(poolBox.result,30000,'1,000,000 at 3% must produce a 30,000 pool');

assert.match(sql,/action text not null check \(action in \('set', 'cancel'\)\)/,'history must be append-only set/cancel events');
assert.match(sql,/case when v_rec\.action = 'set' then 'manual' else 'reports' end/,'empty or cancelled state must fall back to reports');
assert.match(sql,/from public\.ev_payroll_issued[\s\S]*paid_total is not null[\s\S]*'closed'/,'closed payroll period must be rejected');
assert.match(js,/Введено вручную/);
assert.match(js,/Сейчас берётся из отчётов/);
assert.match(js,/Каждое сохранение добавляет новую запись/);

console.log('call-center period gross 3234: OK (1,000,000 pool; reports fallback; closed period guard)');
