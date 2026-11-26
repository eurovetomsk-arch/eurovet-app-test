'use strict';
/* Калькулятор доз v1: только тестовый просмотр клинического черновика.
   Данные загружаются лениво при открытии модуля, live/Supabase не изменяются. */
const DOSE={
  state:'idle',data:null,error:null,species:'dog',weight:'',query:'',group:'all',status:'all',selected:null,limit:24,
  feedback:LS.get('ev_dose_feedback_test_v1',{})
};
const DOSE_STATUS={
  'ПРОЕКТ СХЕМЫ':{key:'draft',label:'Проект схемы',help:'Доза найдена в источнике, но ещё не утверждена для живого применения.'},
  'РУЧНОЙ РЕЖИМ':{key:'manual',label:'Только вручную',help:'Нужен клинический выбор врача, дополнительные параметры или мониторинг.'},
  'ЗАБЛОКИРОВАНО':{key:'blocked',label:'Заблокировано',help:'Не хватает точной формы, концентрации, регистрации или надёжного основания.'},
  'НЕ ПРИМЕНЯЕТСЯ':{key:'na',label:'Доза не применяется',help:'Это материал, среда или процедура без универсальной лекарственной дозы.'},
  'HARD STOP':{key:'stop',label:'Стоп',help:'Позиция исключена из обычного калькулятора по критическому ограничению.'}
};
function doseStatus(x){return DOSE_STATUS[x]||{key:'blocked',label:x||'Не определено',help:'Статус требует проверки.'}}
function doseNorm(s){return String(s||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^a-zа-я0-9%+]+/gi,' ').trim()}
function doseOpen(){closeOv();S.view='dose';render();window.scrollTo(0,0);doseLoad()}
async function doseLoad(){
  if(DOSE.state==='loading'||DOSE.state==='ready')return;
  DOSE.state='loading';DOSE.error=null;if(S.view==='dose')render();
  try{
    const r=await fetch('data/dose-v1.json',{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();
    if(!d||d.schema!=='evrovet.dose_catalog_test/v1'||d.test_only!==true||!Array.isArray(d.items)||d.items.length!==107)throw Error('contract');
    DOSE.data=d;DOSE.state='ready';
  }catch(e){DOSE.state='error';DOSE.error='Справочник не загрузился. Проверьте связь и попробуйте ещё раз.'}
  if(S.view==='dose')render();
}
function doseItems(){
  if(!DOSE.data)return[];
  const q=doseNorm(DOSE.query),parts=q.split(' ').filter(Boolean);
  return DOSE.data.items.filter(x=>{
    if(DOSE.group!=='all'&&x.group!==DOSE.group)return false;
    if(DOSE.status!=='all'&&doseStatus(x.release_status).key!==DOSE.status)return false;
    if(!parts.length)return true;
    const hay=doseNorm([x.source_name,x.name,x.concentration].join(' '));return parts.every(p=>hay.includes(p));
  });
}
function doseFeedbackCount(){return Object.keys(DOSE.feedback||{}).length}
function doseTop(){
  return '<section class="dose-head"><button class="dose-back" data-act="go" data-v="branch">‹ Назад</button><span class="dose-test">ТЕСТ</span><h1>Расчёт дозы</h1><p>Проверяем справочник вместе с врачами. Это клинический черновик: приложение пока не назначает препарат и не выбирает дозу за врача.</p></section>';
}
function doseLoading(){return doseTop()+'<div class="card dose-loading" aria-live="polite"><span></span><b>Загружаю 107 карточек…</b><small>Остальные разделы приложения не загружаются повторно.</small></div>'}
function doseFilters(){
  const gs=[['all','Все 107'],['Медицинские','Медицинские 78'],['Ветеринарные','Ветеринарные 29']];
  const ss=[['all','Все статусы'],['draft','Проект схемы'],['manual','Только вручную'],['blocked','Заблокировано'],['na','Не применяется']];
  return '<div class="card dose-search"><label for="dose-q">Найти препарат</label><input id="dose-q" class="srch" data-dose-input="search" type="search" autocomplete="off" enterkeyhint="search" placeholder="Название, МНН или концентрация" value="'+esc(DOSE.query)+'">'
    +'<div class="dose-filter-scroll" aria-label="Группа">'+gs.map(x=>'<button data-dose-act="group" data-value="'+esc(x[0])+'" class="chip'+(DOSE.group===x[0]?' on':'')+'">'+esc(x[1])+'</button>').join('')+'</div>'
    +'<div class="dose-filter-scroll dose-status-filter" aria-label="Статус">'+ss.map(x=>'<button data-dose-act="status" data-value="'+esc(x[0])+'" class="chip'+(DOSE.status===x[0]?' on':'')+'">'+esc(x[1])+'</button>').join('')+'</div></div>';
}
function doseList(){
  const all=doseItems(),shown=all.slice(0,DOSE.limit);
  if(!all.length)return '<div class="card dose-empty"><b>Ничего не найдено</b><p>Попробуйте другое название или снимите фильтр.</p></div>';
  return '<div class="dose-list-head"><b>Найдено: '+all.length+'</b><small>Отзывов на этом устройстве: '+doseFeedbackCount()+'</small></div><div class="dose-list">'
    +shown.map(x=>{const s=doseStatus(x.release_status),fb=DOSE.feedback[x.id];return '<button class="dose-row" data-dose-act="open" data-id="'+esc(x.id)+'"><span class="dose-row-main"><b>'+esc(x.source_name)+'</b>'+(x.name&&x.name!==x.source_name?'<small>'+esc(x.name)+'</small>':'')+'<em>'+esc(x.concentration||'Концентрация не указана')+'</em></span><span class="dose-row-side"><i class="dose-badge '+s.key+'">'+esc(s.label)+'</i>'+(fb?'<small class="dose-reviewed">✓ отзыв</small>':'')+'</span></button>'}).join('')+'</div>'
    +(shown.length<all.length?'<button class="btn sec dose-more" data-dose-act="more">Показать ещё '+Math.min(24,all.length-shown.length)+'</button>':'');
}
function doseSpeciesControls(){
  return '<div class="dose-patient card"><h2>Пациент</h2><div class="dose-species"><button data-dose-act="species" data-value="dog" class="'+(DOSE.species==='dog'?'on':'')+'">Собака</button><button data-dose-act="species" data-value="cat" class="'+(DOSE.species==='cat'?'on':'')+'">Кошка</button></div><label for="dose-weight">Масса, кг</label><input id="dose-weight" data-dose-input="weight" inputmode="decimal" autocomplete="off" placeholder="Например, 4,5" value="'+esc(DOSE.weight)+'"><p class="hint">Масса сохранена только на текущем экране. Автоматический объём пока не рассчитывается.</p></div>';
}
function doseTextBlock(title,text,cls){return text?'<section class="dose-info '+(cls||'')+'"><h3>'+esc(title)+'</h3><p>'+esc(text).replace(/\n/g,'<br>')+'</p></section>':''}
function doseDetail(x){
  const s=doseStatus(x.release_status),scheme=DOSE.species==='cat'?x.cat:x.dog,fb=DOSE.feedback[x.id];
  return doseTop()+'<button class="dose-list-back" data-dose-act="close">‹ К списку препаратов</button>'+doseSpeciesControls()
    +'<article class="card dose-card"><div class="dose-title"><span><small>'+esc(x.group)+'</small><h2>'+esc(x.source_name)+'</h2>'+(x.name&&x.name!==x.source_name?'<p>'+esc(x.name)+'</p>':'')+'</span><i class="dose-badge '+s.key+'">'+esc(s.label)+'</i></div>'
    +'<div class="dose-concentration"><span>Форма и концентрация</span><b>'+esc(x.concentration||'Не указана — расчёт объёма запрещён')+'</b></div>'
    +'<div class="dose-status-note '+s.key+'"><b>'+esc(s.label)+'</b><span>'+esc(s.help)+'</span></div>'
    +doseTextBlock(DOSE.species==='cat'?'Схема для кошки':'Схема для собаки',scheme,'primary')
    +(!scheme?'<div class="dose-no-scheme">Для выбранного вида схема не заполнена. Использовать позицию для расчёта нельзя.</div>':'')
    +doseTextBlock('Диапазон и пределы',x.min_max)
    +doseTextBlock('Путь введения',x.route)
    +doseTextBlock('Кратность',x.frequency)
    +doseTextBlock('Ограничения и противопоказания',x.restrictions,'warning')
    +doseTextBlock('Основание черновика',x.evidence)
    +doseTextBlock('On-label / off-label',x.label_status)
    +'<div class="dose-calc-locked"><b>Автоматический расчёт пока закрыт</b><p>Сначала врачи подтверждают карточку, точную форму и концентрацию. До этого приложение показывает источник для проверки, но не выдаёт готовое назначение.</p></div>'
    +'<div class="dose-feedback"><h3>Проверка врачом</h3><p>Оцените именно эту карточку. На первом экране отзыв сохраняется только на тестовом устройстве.</p><div><button data-dose-act="feedback" data-value="correct" class="btn">Доза и ограничения верны</button><button data-dose-act="feedback" data-value="fix" class="btn sec">Нужно исправить</button><button data-dose-act="feedback" data-value="unused" class="btn sec">Не используем в клинике</button></div>'
    +(fb?'<p class="dose-feedback-saved">✓ Сохранено: '+esc({correct:'верно',fix:'нужно исправить',unused:'не используем'}[fb.verdict]||fb.verdict)+(fb.note?' — '+esc(fb.note):'')+'</p>':'')+'</div></article>';
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
document.addEventListener('input',e=>{
  const k=e.target&&e.target.dataset&&e.target.dataset.doseInput;if(!k)return;
  if(k==='search'){DOSE.query=e.target.value;DOSE.limit=24;dosePaintList()}
  if(k==='weight'){
    const p=e.target.value.replace(/\./g,',').replace(/[^0-9,]/g,'').split(',');
    DOSE.weight=p[0].slice(0,3)+(p.length>1?','+p.slice(1).join('').slice(0,3):'');
    if(e.target.value!==DOSE.weight)e.target.value=DOSE.weight;
  }
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-dose-act]');if(!b)return;
  const a=b.dataset.doseAct,v=b.dataset.value;
  if(a==='group'){DOSE.group=v;DOSE.limit=24;document.querySelectorAll('[data-dose-act="group"]').forEach(x=>x.classList.toggle('on',x.dataset.value===v));dosePaintList()}
  else if(a==='status'){DOSE.status=v;DOSE.limit=24;document.querySelectorAll('[data-dose-act="status"]').forEach(x=>x.classList.toggle('on',x.dataset.value===v));dosePaintList()}
  else if(a==='more'){DOSE.limit+=24;dosePaintList()}
  else if(a==='open'){DOSE.selected=b.dataset.id;render();window.scrollTo(0,0)}
  else if(a==='close'){DOSE.selected=null;render();window.scrollTo(0,0)}
  else if(a==='species'){DOSE.species=v;render()}
  else if(a==='retry'){DOSE.state='idle';doseLoad()}
  else if(a==='feedback')doseFeedbackForm(v)
  else if(a==='feedback-save')doseSaveFeedback(v)
});
