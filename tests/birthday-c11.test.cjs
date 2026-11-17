'use strict';
/* Поздравление с днём рождения (п.18): тексты без эмодзи и без оранжевого, варианты f/m/n, показ только когда есть метка и не нажато «Спасибо!»,
   «Спасибо!» вызывает ev_birthday_ack, предпросмотр руководителя ack не вызывает. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','scripts','birthday.js'),'utf8');
assert.doesNotMatch(src,/[\u{1F300}-\u{1FAFF}☀-➿]/u,'нет эмодзи в тексте');
const calls=[];let shown=null;
const doc={getElementById:()=>null,body:{classList:{add(){},remove(){}},appendChild(w){shown=w}},createElement:()=>({set innerHTML(v){this._h=v},get innerHTML(){return this._h},querySelector:()=>null,setAttribute(){},className:'',remove(){}})};
const ctx={S:{token:'t',person:{id:7,short_name:'Орлов И.П.'}},rpc:async(n,a)=>{calls.push(n);return n==='ev_birthday_today'?{ok:true,today:true,variant:'m2',acked:false}:{ok:true}},omskToday:()=>'2026-12-01',esc:s=>String(s),stageGreetingName:()=>'Илья Петрович',document:doc,window:{},navigator:{vibrate(){}},matchMedia:()=>({matches:false}),setTimeout:()=>0,closeOv(){},overlay(){},console,Math};
vm.createContext(ctx);vm.runInContext(src+';this.bdVariant=bdVariant;this.birthdayCheck=birthdayCheck;this.bdThanks=bdThanks;this.bdShow=bdShow;this.BD_TEXTS=BD_TEXTS;this.bdBody=bdBody;this.bdPreview=bdPreview;',ctx);
(async()=>{
  assert.equal(ctx.BD_TEXTS.f.length,5);assert.equal(ctx.BD_TEXTS.m.length,5);assert.equal(ctx.BD_TEXTS.n.length,3);
  assert.equal(ctx.bdVariant('m2').group,'m');assert.equal(ctx.bdVariant('n3').index,2);assert.equal(ctx.bdVariant('zzz').group,'n');
  assert.doesNotMatch(ctx.bdBody(ctx.BD_TEXTS.f[0].replace('{Имя}','X')),/^С днём/i);
  await ctx.birthdayCheck();assert.deepEqual(calls,['ev_birthday_today']);assert.ok(shown,'экран показан');assert.match(shown.innerHTML,/Илья Петрович/);assert.match(shown.innerHTML,/Спасибо!/);
  calls.length=0;await ctx.birthdayCheck();assert.equal(calls.length,0,'один раз в сутки на устройство');
  await ctx.bdThanks();assert.ok(calls.includes('ev_birthday_ack'),'ack при нажатии');
  calls.length=0;ctx.bdPreview('f');await ctx.bdThanks();assert.equal(calls.includes('ev_birthday_ack'),false,'предпросмотр не пишет ack');
  console.log('birthday c11: OK (13 текстов без эмодзи, показ по метке, ack при «Спасибо!», предпросмотр без записи)');
})().catch(e=>{console.error(e);process.exit(1)});
