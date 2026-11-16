const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const appSource=require('./app-source.cjs');

const root=path.resolve(__dirname,'..');
const html=appSource(root);

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

async function main(){
  const loadBank=fn(html,'muLoadBank').replace(/^function muLoadBank/,'async function muLoadBank');
  const messages={
    period_issued:'Период уже выдан. Выберите другой',
    period_not_ready:'Для периода ещё не загружены начисления трёх филиалов',
    period_future:'Период начинается позже даты платежа. Выберите другой'
  };
  async function run(error){
    const sandbox={
    S:{
      token:'test-token',view:'mu',
      mu:{
        busy:false,msg:null,
        bank:{
          period:['2026-11-01','2026-11-15'],hash:'test-hash',done:null,err:null,
          rows:[{person_id:7,amount:100,date:'2026-11-13'}]
        }
      }
    },
    MU_ERR:messages,
    rpc:async(name)=>{
      assert.equal(name,'ev_mu_load_bank');
      return{ok:false,error};
    },
    muReloadBatches:async()=>{},
    muR2:x=>Math.round(x*100)/100,
    muF:x=>String(x),ruDate:x=>x,
    confirm:()=>true,paint:()=>{},toast:()=>{},render:()=>{},
    document:{getElementById:()=>null},
    LS:{del:()=>{}},
    Number,String,Array,Math
    };
    vm.runInNewContext(loadBank+';result=muLoadBank();',sandbox);
    await sandbox.result;
    assert.equal(sandbox.S.mu.bank.err,messages[error]);
    assert.equal(sandbox.S.mu.bank.done,null);
    assert.equal(sandbox.S.mu.msg,null);
    assert.equal(sandbox.S.mu.busy,false);
  }
  for(const error of Object.keys(messages))await run(error);
  const sql=fs.readFileSync(path.join(root,'test-db-3225.sql'),'utf8');
  assert.match(sql,/v_pay_date date/);
  assert.match(sql,/p_from > v_pay_date/);
  assert.match(sql,/error', 'period_future'/);
  console.log('payroll server errors 3287: OK (period_issued, period_not_ready, period_future mocks)');
}

main().catch(error=>{console.error(error);process.exitCode=1});
