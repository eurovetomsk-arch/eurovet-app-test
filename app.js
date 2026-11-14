'use strict';
(() => {
const cfg=window.STAGE1;
if(cfg.url!=='https://txcibtcfuzqhhebeguby.supabase.co') throw Error('Test isolation required');
let token=null,num='',pin='',step='num',busy=false,branch=null,acceptKey=null;
const screens=[...document.querySelectorAll('.screen')];
const error=document.getElementById('error');
function go(id){screens.forEach(s=>s.classList.toggle('on',s.dataset.s===id));}
function reset(){num='';pin='';step='num';draw();}
function draw(){document.querySelectorAll('#numBoxes span').forEach((b,i)=>{b.textContent=num[i]||'';b.classList.toggle('cur',step==='num'&&i===num.length);});document.querySelectorAll('#pinDots i').forEach((d,i)=>d.classList.toggle('f',i<pin.length));document.getElementById('stepNum').style.display=step==='num'?'':'none';document.getElementById('stepPin').style.display=step==='pin'?'':'none';document.getElementById('loginTitle').textContent=step==='num'?'Твой личный номер':'Теперь PIN';document.getElementById('numShow').textContent=num;}
async function rpc(action,payload={}){
 if(!cfg.key)throw Error('Тестовый сервер ещё не подключён');
 const r=await fetch(cfg.url+'/rest/v1/rpc/ev_stage1',{method:'POST',cache:'no-store',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:payload,p_token:token})});
 if(!r.ok)throw Error('Сервер недоступен');const data=await r.json();
 if(data.error){if(data.error==='session_replaced'){token=null;reset();go('9');}if(data.error==='session_expired'){token=null;reset();go('2');}throw Error(data.error==='invalid_credentials'?'Номер или PIN не совпали':data.error);}
 return data;
}
async function login(){busy=true;const credentials={number:num,pin,shared:document.getElementById('shared').checked};reset();try{const r=await rpc('login',credentials);token=r.token;if(!r.can_select_branch){await rpc('logout');token=null;throw Error('Для этой роли этап 1 не включает главный экран');}document.querySelectorAll('[data-branch]').forEach(b=>{const scheduled=branchId(b.dataset.branch)===r.scheduled;b.classList.toggle('bmain',scheduled);b.querySelector('.bhint')?.remove();if(scheduled){const hint=document.createElement('small');hint.className='bhint';hint.textContent='по графику ты здесь';b.querySelector('.name').after(hint);}});go('3');}catch(e){error.textContent=e.message;}finally{credentials.pin='';credentials.number='';busy=false;}}
function branchId(s){return s.startsWith('Маркса')?'marksa':s.startsWith('70')?'70let':'pereleta';}
document.getElementById('pad').addEventListener('click',e=>{if(busy)return;const b=e.target.closest('button');if(!b||b.classList.contains('blank'))return;if(b.classList.contains('del')){if(step==='pin'){if(pin)pin=pin.slice(0,-1);else step='num';}else num=num.slice(0,-1);}else if(/^\d$/.test(b.textContent.trim())){if(step==='num'){num+=b.textContent.trim();if(num.length===3)step='pin';}else{pin+=b.textContent.trim();if(pin.length===6){void login();return;}}}draw();});
document.addEventListener('click',async e=>{if(busy)return;const b=e.target.closest('button');if(!b)return;try{if(b.dataset.go){reset();go(b.dataset.go);return;}if(b.dataset.branch){busy=true;branch=branchId(b.dataset.branch);await rpc('select_branch',{branch});document.querySelectorAll('.br-name').forEach(x=>x.textContent=b.dataset.branch);document.querySelectorAll('.br-short').forEach(x=>x.textContent=b.dataset.branch.split(',')[0]);document.getElementById('sum').value='';acceptKey=null;go('4');}if(b.dataset.act==='renum')reset();if(b.dataset.act==='accept'){const value=document.getElementById('sum').value.replace(/\s/g,'').replace(',','.');if(!/^\d{1,10}(\.\d{1,2})?$/.test(value))throw Error('Введи сумму с точностью до копейки');busy=true;const r=await rpc('accept',{branch,actual:value});acceptKey=r.id;if(Number(r.difference)===0){document.querySelector('.sum-show').textContent=r.actual;go('4a');}else{document.getElementById('diffVal').textContent=Math.abs(Number(r.difference)).toLocaleString('ru-RU',{minimumFractionDigits:2});go('4b');}}if(b.dataset.act==='finish'){await rpc('logout');token=null;reset();go('1');}}catch(e){error.textContent=e.message;window.alert(e.message);}finally{busy=false;}});
setInterval(async()=>{if(!token||busy)return;try{await rpc('status');}catch(e){error.textContent=e.message;}},60000);
window.addEventListener('pagehide',()=>{token=null;reset();});
reset();go('1');
})();
