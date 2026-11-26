'use strict';
/* Калькулятор доз c35: тестовый клинический сценарий без записи в Supabase.
   Каталог и структурированные правила загружаются только при открытии модуля. */
const DOSE={
  state:'idle',data:null,rules:null,error:null,species:'dog',weight:'',doseValue:'',route:'',query:'',group:'all',status:'calc',selected:null,limit:24,
  feedback:LS.get('ev_dose_feedback_test_v1',{})
};
const DOSE_STATUS={
  'ПРОЕКТ СХЕМЫ':{key:'draft',label:'Проект схемы',help:'Есть структурированная схема для тестирования врачами.'},
  'РУЧНОЙ РЕЖИМ':{key:'manual',label:'Только вручную',help:'Нужны дополнительные клинические параметры, титрование или мониторинг.'},
  'ЗАБЛОКИРОВАНО':{key:'blocked',label:'Заблокировано',help:'Не хватает точной формы, концентрации или надёжного основания.'},
  'НЕ ПРИМЕНЯЕТСЯ':{key:'na',label:'Без расчёта',help:'Это материал, среда или процедура без универсальной лекарственной дозы.'},
  'HARD STOP':{key:'stop',label:'Стоп',help:'Позиция исключена из обычного калькулятора по критическому ограничению.'}
};
function doseStatus(x){return DOSE_STATUS[x]||{key:'blocked',label:x||'Не определено',help:'Статус требует проверки.'}}
function doseNorm(s){return String(s||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^a-zа-я0-9%+]+/gi,' ').trim()}
function doseOpen(){closeOv();S.view='dose';render();window.scrollTo(0,0);doseLoad()}
async function doseLoad(){
  if(DOSE.state==='loading'||DOSE.state==='ready')return;
  DOSE.state='loading';DOSE.error=null;if(S.view==='dose')render();
  try{
    const [catalogRes,rulesRes]=await Promise.all([
      fetch('data/dose-v1.json',{cache:'no-cache'}),
      fetch('data/dose-rules-v1.json',{cache:'no-cache'})
    ]);
    if(!catalogRes.ok||!rulesRes.ok)throw Error('HTTP '+catalogRes.status+'/'+rulesRes.status);
    const [d,rr]=await Promise.all([catalogRes.json(),rulesRes.json()]);
    if(!d||d.schema!=='evrovet.dose_catalog_test/v1'||d.test_only!==true||!Array.isArray(d.items)||d.items.length!==107)throw Error('catalog contract');
    if(!rr||rr.schema!=='evrovet.dose_rules_test/v1'||rr.test_only!==true||!Array.isArray(rr.rules)||rr.rules.length!==14)throw Error('rules contract');
    DOSE.data=d;DOSE.rules=rr;DOSE.state='ready';
  }catch(e){DOSE.state='error';DOSE.error='Калькулятор не загрузился. Проверьте связь и попробуйте ещё раз.'}
  if(S.view==='dose')render();
}
function doseRulesFor(item,species){return !DOSE.rules?[]:DOSE.rules.rules.filter(r=>r.item_id===item.id&&(!species||r.species===species))}
function doseItems(){
  if(!DOSE.data)return[];
  const q=doseNorm(DOSE.query),parts=q.split(' ').filter(Boolean);
  return DOSE.data.items.filter(x=>{
    if(DOSE.group!=='all'&&x.group!==DOSE.group)return false;
    if(DOSE.status==='calc'&&!doseRulesFor(x).length)return false;
    if(DOSE.status!=='all'&&DOSE.status!=='calc'&&doseStatus(x.release_status).key!==DOSE.status)return false;
    if(!parts.length)return true;
    const hay=doseNorm([x.source_name,x.name,x.concentration].join(' '));return parts.every(p=>hay.includes(p));
  });
}
function doseFeedbackCount(){return Object.keys(DOSE.feedback||{}).length}
function doseTop(){
  return '<section class="dose-head"><button class="dose-back" data-act="go" data-v="branch">‹ Назад</button><span class="dose-test">ТЕСТ</span><h1>Расчёт дозы</h1><p>Быстрый расчёт на одно введение. Препарат, дозу и путь введения подтверждает врач.</p></section>';
}
function doseLoading(){return doseTop()+'<div class="card dose-loading" aria-live="polite"><span></span><b>Открываю калькулятор…</b><small>Каталог загружается только на этом экране.</small></div>'}
function doseFilters(){
  const gs=[['all','Все 107'],['Медицинские','Медицинские 78'],['Ветеринарные','Ветеринарные 29']];
  const ss=[['calc','Расчёт доступен · 8'],['all','Весь справочник'],['manual','Только вручную'],['blocked','Заблокировано'],['na','Без расчёта']];
  return '<div class="card dose-search"><label for="dose-q">Найти препарат</label><input id="dose-q" class="srch" data-dose-input="search" type="search" autocomplete="off" enterkeyhint="search" placeholder="Название или концентрация" value="'+esc(DOSE.query)+'">'
    +'<div class="dose-filter-scroll" aria-label="Группа">'+gs.map(x=>'<button data-dose-act="group" data-value="'+esc(x[0])+'" class="chip'+(DOSE.group===x[0]?' on':'')+'">'+esc(x[1])+'</button>').join('')+'</div>'
    +'<div class="dose-filter-scroll dose-status-filter" aria-label="Статус">'+ss.map(x=>'<button data-dose-act="status" data-value="'+esc(x[0])+'" class="chip'+(DOSE.status===x[0]?' on':'')+'">'+esc(x[1])+'</button>').join('')+'</div></div>';
}
function doseSpeciesLabel(rules){
  const species=new Set(rules.map(r=>r.species));
  return species.size===2?'Собака · кошка':species.has('dog')?'Только собака':'Только кошка';
}
function doseList(){
  const all=doseItems(),shown=all.slice(0,DOSE.limit);
  if(!all.length)return '<div class="card dose-empty"><b>Ничего не найдено</b><p>Попробуйте другое название или откройте весь справочник.</p></div>';
  return '<div class="dose-list-head"><b>Найдено: '+all.length+'</b><small>Отзывов на этом устройстве: '+doseFeedbackCount()+'</small></div><div class="dose-list">'
    +shown.map(x=>{const s=doseStatus(x.release_status),fb=DOSE.feedback[x.id],rules=doseRulesFor(x);return '<button class="dose-row" data-dose-act="open" data-id="'+esc(x.id)+'"><span class="dose-row-main"><b>'+esc(x.source_name)+'</b>'+(x.name&&x.name!==x.source_name?'<small>'+esc(x.name)+'</small>':'')+'<em>'+esc(x.concentration||'Концентрация не указана')+'</em></span><span class="dose-row-side">'+(rules.length?'<i class="dose-badge calc">Рассчитать</i><small>'+esc(doseSpeciesLabel(rules))+'</small>':'<i class="dose-badge '+s.key+'">'+esc(s.label)+'</i>')+(fb?'<small class="dose-reviewed">✓ отзыв</small>':'')+'</span></button>'}).join('')+'</div>'
    +(shown.length<all.length?'<button class="btn sec dose-more" data-dose-act="more">Показать ещё '+Math.min(24,all.length-shown.length)+'</button>':'');
}
function doseSpeciesControls(){
  return '<div class="dose-patient card"><h2>Пациент</h2><div class="dose-species"><button data-dose-act="species" data-value="dog" class="'+(DOSE.species==='dog'?'on':'')+'">Собака</button><button data-dose-act="species" data-value="cat" class="'+(DOSE.species==='cat'?'on':'')+'">Кошка</button></div><label for="dose-weight">Масса пациента, кг</label><div class="dose-weight-wrap"><input id="dose-weight" data-dose-input="weight" inputmode="decimal" autocomplete="off" placeholder="Например, 4,5" value="'+esc(DOSE.weight)+'"><span>кг</span></div></div>';
}
function doseTextBlock(title,text,cls){return text?'<section class="dose-info '+(cls||'')+'"><h3>'+esc(title)+'</h3><p>'+esc(text).replace(/\n/g,'<br>')+'</p></section>':''}
function doseDecimal(value){
  const s=String(value==null?'':value).trim().replace(',','.');if(!/^\d+(?:\.\d+)?$/.test(s))return null;
  const p=s.split('.'),den=10n**BigInt((p[1]||'').length),num=BigInt(p[0]+(p[1]||''));return num>0n?{num,den}:null;
}
function doseMul(a,b){return{num:a.num*b.num,den:a.den*b.den}}
function doseDiv(a,b){return{num:a.num*b.den,den:a.den*b.num}}
function doseFmt(frac,max=3){
  const scale=10n**BigInt(max),scaled=(frac.num*scale+frac.den/2n)/frac.den,whole=scaled/scale;
  let dec=String(scaled%scale).padStart(max,'0').replace(/0+$/,'');return String(whole)+(dec?','+dec:'');
}
function doseActiveRule(item){return doseRulesFor(item,DOSE.species)[0]||null}
function doseChosenDose(rule){return rule&&rule.dose_min_mg_kg===rule.dose_max_mg_kg?rule.dose_min_mg_kg:DOSE.doseValue}
function doseChosenRoute(rule){return rule&&rule.routes.length===1?rule.routes[0].id:DOSE.route}
function doseCalculation(rule){
  if(!rule)return{ok:false,reason:'Для выбранного вида быстрый расчёт пока не подготовлен.'};
  const w=doseDecimal(DOSE.weight);if(!w||Number(String(DOSE.weight).replace(',','.'))<0.05||Number(String(DOSE.weight).replace(',','.'))>200)return{ok:false,reason:'Введите массу пациента от 0,05 до 200 кг.'};
  const dose=doseDecimal(doseChosenDose(rule));if(!dose)return{ok:false,reason:'Выберите дозу в разрешённом диапазоне.'};
  const d=Number(doseChosenDose(rule)),min=Number(rule.dose_min_mg_kg),max=Number(rule.dose_max_mg_kg);
  if(d<min||d>max)return{ok:false,reason:'Доза должна быть от '+String(min).replace('.',',')+' до '+String(max).replace('.',',')+' мг/кг.'};
  const routeId=doseChosenRoute(rule),route=rule.routes.find(x=>x.id===routeId);if(!route)return{ok:false,reason:'Выберите место введения.'};
  const mg=doseMul(w,dose),ml=doseDiv(mg,doseDecimal(rule.concentration_mg_ml));
  return{ok:true,weight:doseFmt(w),dose:doseFmt(dose),mg:doseFmt(mg),ml:doseFmt(ml),route};
}
function doseResultHtml(rule){
  const c=doseCalculation(rule);
  if(!c.ok)return '<div class="dose-result pending" id="dose-calc-result" aria-live="polite"><b>Чтобы получить объём</b><p>'+esc(c.reason)+'</p></div>';
  const extras=[];
  if(rule.max_per_site_ml)extras.push('Не более '+String(rule.max_per_site_ml).replace('.',',')+' мл в одно место');
  if(rule.max_daily_mg_kg)extras.push('Суточный предел: '+String(rule.max_daily_mg_kg).replace('.',',')+' мг/кг');
  return '<div class="dose-result ready" id="dose-calc-result" aria-live="polite"><small>НА ОДНО ВВЕДЕНИЕ</small><strong>'+esc(c.ml)+' мл</strong><h3>'+esc(c.route.label)+'</h3><p class="dose-frequency">'+esc(rule.frequency)+'</p>'
    +'<p class="dose-trace">'+esc(c.dose)+' мг/кг × '+esc(c.weight)+' кг = '+esc(c.mg)+' мг<br>'+esc(c.mg)+' мг ÷ '+esc(rule.concentration_mg_ml.replace('.',','))+' мг/мл = '+esc(c.ml)+' мл</p>'
    +(extras.length?'<div class="dose-result-warn">'+extras.map(esc).join('<br>')+'</div>':'')+'</div>';
}
function doseCalcPanel(item,rule){
  if(!rule){const s=doseStatus(item.release_status);return '<section class="dose-calc-locked"><b>Быстрый расчёт недоступен</b><p>'+esc(s.help)+'</p></section>'}
  const fixed=rule.dose_min_mg_kg===rule.dose_max_mg_kg;
  const routes=rule.routes.map(r=>'<button data-dose-act="route" data-value="'+esc(r.id)+'" class="'+(doseChosenRoute(rule)===r.id?'on':'')+'">'+esc(r.label)+'</button>').join('');
  return '<section class="dose-calc"><div class="dose-indication"><small>СХЕМА</small><b>'+esc(rule.indication)+'</b></div>'
    +'<div class="dose-choice"><label for="dose-dose">Доза, мг/кг</label>'+(fixed?'<div class="dose-fixed">'+esc(rule.dose_min_mg_kg.replace('.',','))+' мг/кг</div>':'<div class="dose-dose-wrap"><input id="dose-dose" data-dose-input="dose" inputmode="decimal" autocomplete="off" placeholder="'+esc(rule.dose_min_mg_kg.replace('.',','))+'–'+esc(rule.dose_max_mg_kg.replace('.',','))+'" value="'+esc(DOSE.doseValue)+'"><span>мг/кг</span></div><small>Выберите от '+esc(rule.dose_min_mg_kg.replace('.',','))+' до '+esc(rule.dose_max_mg_kg.replace('.',','))+'</small>')+'</div>'
    +'<div class="dose-route"><label>Место введения</label><div>'+routes+'</div></div>'
    +doseResultHtml(rule)
    +'<p class="dose-guard">Тестовый расчёт. Дозу, показание и форму препарата подтверждает врач.</p></section>';
}
function doseDetails(item,scheme,rule){
  const warnings=rule&&rule.warnings_short||[];
  return '<details class="dose-details"><summary>Ограничения и подробности</summary><div>'
    +(warnings.length?'<section class="dose-quick-warnings"><h3>Важно</h3>'+warnings.map(x=>'<p>• '+esc(x)+'</p>').join('')+'</section>':'')
    +doseTextBlock(DOSE.species==='cat'?'Исходная схема для кошки':'Исходная схема для собаки',scheme)
    +doseTextBlock('Диапазон и пределы',item.min_max)+doseTextBlock('Путь введения',item.route)+doseTextBlock('Кратность',item.frequency)
    +doseTextBlock('Ограничения и противопоказания',item.restrictions,'warning')+doseTextBlock('Основание черновика',item.evidence)+doseTextBlock('On-label / off-label',item.label_status)
    +'</div></details>';
}
function doseFeedbackSection(item){
  const fb=DOSE.feedback[item.id];return '<details class="dose-review"><summary>Дать отзыв по карточке</summary><div class="dose-feedback"><p>Отзыв сохраняется только на тестовом устройстве.</p><div><button data-dose-act="feedback" data-value="correct" class="btn">Всё верно</button><button data-dose-act="feedback" data-value="fix" class="btn sec">Нужно исправить</button><button data-dose-act="feedback" data-value="unused" class="btn sec">Не используем</button></div>'+(fb?'<p class="dose-feedback-saved">✓ Сохранено: '+esc({correct:'верно',fix:'нужно исправить',unused:'не используем'}[fb.verdict]||fb.verdict)+(fb.note?' — '+esc(fb.note):'')+'</p>':'')+'</div></details>'}
function doseSearchBack(bottom){return '<button class="dose-search-back'+(bottom?' bottom':'')+'" data-dose-act="close"><span aria-hidden="true">⌕</span><b>Найти другой препарат</b><small>Вернуться к поиску</small></button>'}
function doseDetail(item){
  const s=doseStatus(item.release_status),scheme=DOSE.species==='cat'?item.cat:item.dog,rule=doseActiveRule(item),allRules=doseRulesFor(item);
  return doseTop()+doseSearchBack(false)+doseSpeciesControls()
    +'<article class="card dose-card"><div class="dose-title"><span><small>'+esc(item.group)+'</small><h2>'+esc(item.source_name)+'</h2>'+(item.name&&item.name!==item.source_name?'<p>'+esc(item.name)+'</p>':'')+'</span>'+(allRules.length?'<i class="dose-badge calc">Расчёт доступен</i>':'<i class="dose-badge '+s.key+'">'+esc(s.label)+'</i>')+'</div>'
    +'<div class="dose-concentration"><span>Рабочая концентрация</span><b>'+esc(item.concentration||'Не указана')+'</b></div>'
    +doseCalcPanel(item,rule)+doseDetails(item,scheme,rule)+doseFeedbackSection(item)+'</article>'+doseSearchBack(true);
}
function doseHtml(){
  if(DOSE.state==='idle'){setTimeout(doseLoad,0);return doseLoading()}
  if(DOSE.state==='loading')return doseLoading();
  if(DOSE.state==='error')return doseTop()+'<div class="card dose-empty"><b>'+esc(DOSE.error)+'</b><button class="btn" data-dose-act="retry">Повторить</button></div>';
  const selected=DOSE.selected&&DOSE.data.items.find(x=>x.id===DOSE.selected);
  return '<main class="dose-screen">'+(selected?doseDetail(selected):doseTop()+doseFilters()+'<div id="dose-results">'+doseList()+'</div>')+'</main>';
}
function dosePaintList(){
  if(S.view!=='dose'||DOSE.selected){render();return}
  const root=document.getElementById('dose-results');if(!root){render();return}root.innerHTML=doseList();
}
function dosePaintResult(){
  if(!DOSE.selected||!DOSE.data)return;
  const item=DOSE.data.items.find(x=>x.id===DOSE.selected),root=document.getElementById('dose-calc-result');if(!item||!root)return;
  const box=document.createElement('div');box.innerHTML=doseResultHtml(doseActiveRule(item));root.replaceWith(box.firstElementChild);
}
function doseFeedbackForm(verdict){
  const x=DOSE.data&&DOSE.data.items.find(i=>i.id===DOSE.selected);if(!x)return;
  const label={correct:'Доза и ограничения верны',fix:'Нужно исправить',unused:'Не используем в клинике'}[verdict]||verdict;
  overlay('<h2>'+esc(label)+'</h2><p class="hint">'+esc(x.source_name)+'</p><label class="f"><span>Комментарий'+(verdict==='correct'?' (необязательно)':'')+'</span><textarea id="dose-fb-note" rows="4" maxlength="600" placeholder="Что именно проверить или исправить"></textarea></label><button class="btn" data-dose-act="feedback-save" data-value="'+esc(verdict)+'">Сохранить отзыв</button><button class="btn sec" style="margin-top:8px" data-act="ovclose">Отмена</button>');
}
function doseSaveFeedback(verdict){
  const note=String((document.getElementById('dose-fb-note')||{}).value||'').trim();
  if(verdict!=='correct'&&note.length<3){toast('Напишите коротко, что нужно проверить');return}
  DOSE.feedback[DOSE.selected]={verdict,note,at:new Date().toISOString()};LS.set('ev_dose_feedback_test_v1',DOSE.feedback);closeOv();render();toast('Отзыв сохранён на тестовом устройстве');
}
function doseCleanInput(el,decimals){
  const p=el.value.replace(/\./g,',').replace(/[^0-9,]/g,'').split(',');
  const value=p[0].slice(0,3)+(p.length>1?','+p.slice(1).join('').slice(0,decimals):'');if(el.value!==value)el.value=value;return value;
}
document.addEventListener('input',e=>{
  const k=e.target&&e.target.dataset&&e.target.dataset.doseInput;if(!k)return;
  if(k==='search'){DOSE.query=e.target.value;DOSE.limit=24;dosePaintList()}
  else if(k==='weight'){DOSE.weight=doseCleanInput(e.target,3);dosePaintResult()}
  else if(k==='dose'){DOSE.doseValue=doseCleanInput(e.target,3);dosePaintResult()}
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-dose-act]');if(!b)return;
  const a=b.dataset.doseAct,v=b.dataset.value;
  if(a==='group'){DOSE.group=v;DOSE.limit=24;document.querySelectorAll('[data-dose-act="group"]').forEach(x=>x.classList.toggle('on',x.dataset.value===v));dosePaintList()}
  else if(a==='status'){DOSE.status=v;DOSE.limit=24;document.querySelectorAll('[data-dose-act="status"]').forEach(x=>x.classList.toggle('on',x.dataset.value===v));dosePaintList()}
  else if(a==='more'){DOSE.limit+=24;dosePaintList()}
  else if(a==='open'){DOSE.selected=b.dataset.id;DOSE.doseValue='';DOSE.route='';render();window.scrollTo(0,0)}
  else if(a==='close'){DOSE.selected=null;DOSE.query='';DOSE.limit=24;DOSE.doseValue='';DOSE.route='';render();window.scrollTo(0,0);setTimeout(()=>{const q=document.getElementById('dose-q');if(q)q.focus()},0)}
  else if(a==='species'){DOSE.species=v;DOSE.doseValue='';DOSE.route='';render()}
  else if(a==='route'){DOSE.route=v;document.querySelectorAll('[data-dose-act="route"]').forEach(x=>x.classList.toggle('on',x.dataset.value===v));dosePaintResult()}
  else if(a==='retry'){DOSE.state='idle';doseLoad()}
  else if(a==='feedback')doseFeedbackForm(v)
  else if(a==='feedback-save')doseSaveFeedback(v)
});
