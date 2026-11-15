const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const appSource=require('./app-source.cjs');

const html=appSource(path.resolve(__dirname,'..'));

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

const profiles=[
  ['Тестова Татьяна Владимировна','Татьяна Владимировна'],
  ['Докторова Дарья Сергеевна','Дарья Сергеевна'],
  ['Помощникова Анна Игоревна','Анна Игоревна'],
  ['Звонкова Мария Олеговна','Мария Олеговна']
];
const sandbox={result:null,String};
vm.runInNewContext(fn(html,'stageGreetingName')+';result='+JSON.stringify(profiles.map(x=>({full_name:x[0]})))+'.map(stageGreetingName);',sandbox);
assert.deepEqual(Array.from(sandbox.result),profiles.map(x=>x[1]));

for(const name of ['viewBranch','schedHtml','workHtml']){
  assert.match(fn(html,name),/stageGreeting\(S\.person\)/,name+' must render the personal greeting');
}
assert.match(fn(html,'stageGreeting'),/stageGreetingWord\(\)/,'greeting must keep device-time wording');
console.log('greeting profiles: OK (4/4 names; main/branch, schedule and accruals wired)');
