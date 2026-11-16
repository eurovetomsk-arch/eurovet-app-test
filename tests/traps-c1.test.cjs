'use strict';
/* Ловушки отчёта 2.0 (scripts/traps.js, карточка 004): 1 сверка с графиком, 6 расход без комментария, 7 аптека с нулём. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','scripts','traps.js'),'utf8');
function box(form,shifts){
  const calls={overlay:[],errors:null,rpc:0};
  const ctx={
    S:{branch:'marksa',date:'2026-11-16',token:'t',form,ctx:{admins:[{id:16,name:'Фёдорова Т.В.'}],doctors:[{id:2,name:'Орлов И.П.'}],assistants:[{id:11,role:'assistant_clinical',name:'Семёнова А.Р.'}]}},
    N:v=>{const n=Number(String(v??'').replace(',','.'));return isFinite(n)?n:0},
    esc:s=>String(s),overlay:h=>calls.overlay.push(h),closeOv(){},render(){calls.errors=ctx.S.formErrors},toast(){},saveDraft(){},submit:async()=>{},
    setTimeout(){},document:{getElementById:()=>null,querySelector:()=>null},
    rpc:async()=>{calls.rpc++;return{ok:true,shifts}},
    console
  };
  vm.createContext(ctx);vm.runInContext(src+';this.trapGate=trapGate;this.trapData=trapData;this.trapAct=trapAct;',ctx);
  return {ctx,calls};
}
const base=()=>({admins:{16:{}},doctors:{2:{val:'1000'}},assistants:{'assistant_clinical:11':{fn:0,fx:0}},expenses:[],ph_val:'500'});
const today=[{date:'2026-11-16',branch:'marksa',name:'Фёдорова Т.В.'},{date:'2026-11-16',branch:'marksa',name:'Орлов И.П.'},{date:'2026-11-16',branch:'70let',name:'Беляева Н.И.'}];
(async()=>{
  // всё сходится — отчёт уходит
  {const {ctx,calls}=box(base(),today);assert.equal(await ctx.trapGate(),true);assert.equal(calls.overlay.length,0)}
  // 6: расход без комментария — не уходит; инкассация без комментария — можно
  {const f=base();f.expenses=[{article:'Хозрасходы',amount:'300',comment:''},{article:'Инкассация МР',amount:'5000',comment:''}];
   const {ctx,calls}=box(f,today);assert.equal(await ctx.trapGate(),false);assert.equal(calls.errors.length,1);assert.match(calls.errors[0],/Хозрасходы/)}
  // 7: аптека 0 — вопрос; «Да, не работала» — отметка в данных
  {const f=base();f.ph_val='0';const {ctx,calls}=box(f,today);assert.equal(await ctx.trapGate(),false);assert.match(calls.overlay[0],/Аптека не работала/);
   await ctx.trapAct('trap-pharm-closed',{dataset:{}});assert.equal(ctx.S.form.pharmacy_closed,true);assert.equal(await ctx.trapGate(),true);assert.equal(ctx.trapData().pharmacy_closed,true)}
  // 1: по графику работает, в отчёте нет — вопрос; «Нет, не работал» — в данные, дальше отправка
  {const sh=today.concat([{date:'2026-11-16',branch:'marksa',name:'Богданов К.С.'}]);const {ctx,calls}=box(base(),sh);
   assert.equal(await ctx.trapGate(),false);assert.match(calls.overlay[0],/Богданов К\.С\..*его нет в отчёте/);
   await ctx.trapAct('trap-sched-absent',{dataset:{name:'Богданов К.С.'}});assert.equal(await ctx.trapGate(),true);assert.deepEqual([...ctx.trapData().sched_absent],['Богданов К.С.'])}
  // график недоступен — отчёт не блокируется (график — отдельный контур)
  {const {ctx}=box(base(),null);ctx.rpc=async()=>{throw Object.assign(new Error('x'),{net:true})};assert.equal(await ctx.trapGate(),true)}
  console.log('traps c1: OK (1 график, 6 расход, 7 аптека, график недоступен — не блокирует)');
})().catch(e=>{console.error(e);process.exit(1)});
