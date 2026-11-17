const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const report=fs.readFileSync(path.join(root,'scripts/report.js'),'utf8');
const view=fs.readFileSync(path.join(root,'scripts/view.js'),'utf8');
const common=fs.readFileSync(path.join(root,'scripts/common.js'),'utf8');
const base=cp.execFileSync('git',['show','c0b1368:scripts/report.js'],{cwd:root,encoding:'utf8'});

function fn(src,name){
  const lead=(name==='submit'?'async ':'')+'function '+name+'(';
  const start=src.indexOf(lead);assert.notEqual(start,-1,'missing '+name);
  const open=src.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=open;i<src.length;i++){
    const c=src[i];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

assert.match(common,/appVer:'2\.0-test-c7'/);
assert.equal(fn(report,'compute'),fn(base,'compute'),'2.0 financial formulas changed');
assert.equal(fn(report,'validate'),fn(base,'validate'),'2.0 existing validation rules changed');
assert.match(fn(report,'submit'),/В смене не было ассистента\?/);
assert.match(fn(report,'buildData'),/no_assistant:assistants\.length===0&&f\.no_assistant===true/);
assert.match(fn(report,'viewForm'),/Исправьте перед отправкой:/);
assert.match(fn(report,'viewForm'),/Ассистента не было \(отметил админ\)/);
assert.match(fn(report,'viewForm'),/видна руководителю/);
assert.match(view,/case'assistantnone':S\.form\.no_assistant=true/);
assert.match(view,/case'assistantadd'/);
assert.match(view,/if\(g==='assistants'\)f\.no_assistant=false/);
console.log('2.0 test assistant gate: OK');
