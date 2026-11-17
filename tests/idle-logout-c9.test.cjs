'use strict';
/* Автовыход (слово Михаила 17.11): 30 минут бездействия у всех ролей, кроме руководителя; черновик отчёта сохраняется. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','scripts','view.js'),'utf8');
const a=src.indexOf('const IDLE_MS='),b=src.indexOf("['click','keydown'",a);
const code=src.slice(a,b);
assert.match(code,/30\*60\*1000/);
function run(head,minutesIdle,view){
  const log={logout:0,draft:0,toast:0};let now=1e12;
  const ctx={S:{token:'t',view:view||'branch',form:{x:1}},isHead:()=>head,Date:{now:()=>now},closeOv(){},logout(){log.logout++},saveDraftNow(){log.draft++},toast(){log.toast++},
    rpc:()=>Promise.resolve({ok:true}),document:{addEventListener(){}}};
  vm.createContext(ctx);vm.runInContext(code+';this.idleCheck=idleCheck;this.setLast=t=>{accessLastAct=t}',ctx);
  ctx.setLast(now-minutesIdle*60*1000);ctx.idleCheck();return log;
}
assert.equal(run(false,29,'form').logout,0,'29 минут — ещё нет');
let l=run(false,31,'form');assert.equal(l.logout,1);assert.equal(l.draft,1,'черновик сохранён перед выходом');
assert.equal(run(false,31,'branch').draft,0);
assert.equal(run(true,600,'branch').logout,0,'руководитель без автовыхода');
const login=fs.readFileSync(path.join(__dirname,'..','scripts','login.js'),'utf8');
assert.doesNotMatch(login,/shared-device|Это общее устройство/);
console.log('idle logout c9: OK (30 мин, все кроме руководителя, черновик сохраняется, галочки нет)');
