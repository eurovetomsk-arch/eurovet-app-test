'use strict';
/* Загрузка графика из Excel (accruals.js, schPickFile/schImport/schPublish): разбор шаблона, ошибки, сопоставление имён,
   вызовы существующих функций ev_sched_map_name -> ev_sched_import -> ev_sched_publish. Без сети: rpc подменён. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'scripts','accruals.js'),'utf8');
function slice(from,to){const a=src.indexOf(from),b=src.indexOf(to,a);assert.ok(a>=0&&b>a,from);return src.slice(a,b)}
const code=slice('const SCH_ROLE_MAP','function schUploadHtml');
const calls=[];
const ctx={S:{token:'t',mu:{people:[{id:2,short_name:'Орлов И.П.',full_name:'Орлов Илья Петрович'},{id:16,short_name:'Фёдорова Т.В.',full_name:'Фёдорова Татьяна Владимировна'},{id:32,short_name:'Макарова А.В.',full_name:'x'}],busy:false}},
  paint(){},toast(){},confirm:()=>true,addDays:(d,n)=>d,omskToday:()=>'2026-11-17',muLoadX:async()=>{},muSha:async()=>'sha',
  rpc:async(name,a)=>{calls.push([name,a]);if(name==='ev_sched_import')return{ok:true,version_id:calls.length,version:1,rows:a.p_rows.length,unmatched:[]};return{ok:true}},
  XLSX:{read:()=>({SheetNames:['График'],Sheets:{'График':{}}}),utils:{sheet_to_json:()=>ROWS}},esc:s=>String(s),SCH_B:{}};
let ROWS=[];ctx.ROWS=null;
vm.createContext(ctx);vm.runInContext(code+';this.schPickFile=schPickFile;this.schImport=schImport;this.schPublish=schPublish;',ctx);
const file=rows=>({files:[{name:'g.xlsx',arrayBuffer:async()=>new ArrayBuffer(1)}]});
(async()=>{
  // 1) хороший файл + незнакомое имя
  vm.runInContext('var ROWS_=null',ctx);
  ctx.XLSX.utils.sheet_to_json=()=>[['Дата','Филиал','Роль','Сотрудник'],['2026-12-01','Маркса','Администратор','Фёдорова Т.В.'],['01.12.2026','70 лет','Врач','орлов и.п.'],['2026-12-02','Перелёта','Ассистент','Новая Н.Н.'],['2026-12-02','','Колл-центр','Макарова А.В.'],['','','','']];
  await ctx.schPickFile(file());
  let sc=ctx.S.mu.sch;assert.equal(sc.rows.length,4);assert.deepEqual([...sc.months],['2026-12']);assert.deepEqual([...sc.unknown],['Новая Н.Н.']);assert.equal(sc.map['орлов и.п.'],2);
  assert.equal(sc.rows.find(r=>r.slot==='callcenter').branch,'');assert.equal(sc.rows[1].branch,'70let');
  // импорт закрыт, пока имя не выбрано
  await ctx.schImport();assert.equal(calls.length,0);
  sc.map['Новая Н.Н.']=32;await ctx.schImport();
  assert.deepEqual(calls.filter(c=>c[0]==='ev_sched_map_name').length,4);   // 4 пары вид+имя
  const imps=calls.filter(c=>c[0]==='ev_sched_import');assert.deepEqual(imps.map(c=>c[1].p_kind),['admin','clinical','callcenter']);
  assert.equal(imps[1][1].p_month,'2026-12-01');assert.equal(imps[1][1].p_rows.length,2);assert.equal(ctx.S.mu.sch.stage,'draft');
  assert.ok(calls.findIndex(c=>c[0]==='ev_sched_map_name')<calls.findIndex(c=>c[0]==='ev_sched_import'),'сначала имена, потом черновик');
  await ctx.schPublish();assert.equal(calls.filter(c=>c[0]==='ev_sched_publish').length,3);assert.equal(ctx.S.mu.sch.stage,'done');
  // 2) плохой файл: непонятные строки блокируют загрузку по правилу интерфейса (bad непустой), колонки не те
  calls.length=0;ctx.XLSX.utils.sheet_to_json=()=>[['Дата','Филиал','Роль','Сотрудник'],['завтра','Маркса','Врач','Орлов И.П.'],['2026-12-01','Марс','Врач','Орлов И.П.'],['2026-12-01','Маркса','Директор','Орлов И.П.']];
  await ctx.schPickFile(file());assert.equal(ctx.S.mu.err&&ctx.S.mu.err.includes('нет ни одной смены'),true);
  ctx.XLSX.utils.sheet_to_json=()=>[['A','B'],[1,2]];await ctx.schPickFile(file());assert.match(ctx.S.mu.err,/Не тот файл/);
  assert.equal(calls.length,0);
  console.log('sched upload c7: OK (шаблон, автосопоставление, незнакомые имена, порядок вызовов, плохие файлы)');
})().catch(e=>{console.error(e);process.exit(1)});
