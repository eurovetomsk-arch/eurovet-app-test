'use strict';
function homeTab(){const t=S.homeTab||LS.get('ev_htab');return t==='cc'?'cc':'adm'}
function homeTabs(){const t=homeTab();return '<div class="chips tabs" style="margin:0 0 10px">'+[['adm','Администраторы'],['cc','Колл-центр']].map(x=>'<button class="chip'+(t===x[0]?' on':'')+'" data-act="htab" data-t="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'}
function stageGreetingWord(h=(new Date()).getHours()){return h>=5&&h<12?'Доброе утро':h>=12&&h<17?'Добрый день':h>=17&&h<23?'Добрый вечер':'Здравствуйте';}
function stageGreetingName(p){
  const full=String(p?.full_name||p?.name||'').trim(),a=full.split(/\s+/).filter(Boolean);
  if(a.length>=3)return a[1]+' '+a[2];
  const short=String(p?.short_name||p?.name||full).trim();
  return short||'';
}
function stageGreeting(p){const n=stageGreetingName(p);return stageGreetingWord()+(n?', '+n:'');}
function stageRole(p){
  const labels=UI2.roleLabels||{};
  return personRoles(p).map(r=>labels[r]||r).join(' · ');
}

const HOME_WHO={key:'',loading:false,rows:null,error:null};
function homeWhoKey(){return String(S.token||'')+'|'+omskToday()}
async function loadHomeWho(){
  const key=homeWhoKey();
  if(!S.token||HOME_WHO.loading||(HOME_WHO.key===key&&(HOME_WHO.rows||HOME_WHO.error)))return;
  HOME_WHO.key=key;HOME_WHO.loading=true;HOME_WHO.rows=null;HOME_WHO.error=null;
  try{
    const r=await rpc('ev_whos_where',{p_token:S.token,p_from:omskToday(),p_to:omskToday()},8000);
    if(!r||!r.ok)HOME_WHO.error='Сегодняшняя смена пока не загрузилась.';
    else HOME_WHO.rows=Array.isArray(r.rows)?r.rows:[];
  }catch(e){HOME_WHO.error=e.net?'Нет связи: сегодняшняя смена пока не загрузилась.':'Сегодняшняя смена пока не загрузилась.'}
  HOME_WHO.loading=false;if(S.view==='branch')paint();
}
function homeBranchTitle(id){
  const b=BRANCHES.find(x=>String(x.id)===String(id));
  return b?b.title.replace(/,\s*\d+$/,''):String(id||'филиале');
}
function homeTodayHtml(){
  const rows=HOME_WHO.rows;
  if(HOME_WHO.loading||(!rows&&!HOME_WHO.error))return '<div class="glass ui2-today"><span class="pin">⌛</span><div>Загружаю сегодняшнюю смену…</div></div>';
  if(HOME_WHO.error)return '<div class="glass ui2-today calm"><span class="pin">○</span><div>'+esc(HOME_WHO.error)+'</div></div>';
  const pid=String(S.person?.id??S.person?.person_id??'');
  const mine=(rows||[]).find(r=>r&&((r.mine===true)||String(r.person_id??r.id??'')===pid));
  if(!mine)return '<div class="glass ui2-today"><span class="pin">📍</span><div>На сегодня ваша смена в графике не отмечена.</div></div>';
  const branch=mine.branch||mine.branch_id||mine.clinic||mine.clinic_id;
  const start=mine.start||mine.time_from||mine.from||'',end=mine.end||mine.time_to||mine.to||'';
  const peers=(rows||[]).filter(r=>r!==mine&&String(r.branch||r.branch_id||r.clinic||r.clinic_id||'')===String(branch||'')).map(r=>r.short_name||r.name||r.full_name).filter(Boolean).slice(0,3);
  let line='Сегодня вы на <b>'+esc(homeBranchTitle(branch))+'</b>'+(start&&end?', '+esc(start)+'–'+esc(end):'')+'.';
  if(peers.length)line+='<br>С вами: '+peers.map(n=>esc(String(n).trim().replace(/\s+/g,' ').replace(/\.?$/,'.'))).join(', ');
  return '<div class="glass ui2-today"><span class="pin">📍</span><div>'+line+'</div></div>';
}
function headTodayHtml(){
  const d=S.day;
  if(!d||d.date!==omskToday())return '<div class="glass ui2-today"><span class="pin">⌛</span><div>Загружаю статус отчётов…</div></div>';
  const list=Array.isArray(d.list)?d.list:[],done=list.filter(x=>x.submitted).length,waiting=list.filter(x=>!x.submitted).map(x=>brTitle(x.branch));
  return '<div class="glass ui2-today"><span class="pin">✓</span><div><b>Отчёты сегодня: '+done+' из 3.</b>'+(waiting.length?'<br>Ждём: '+waiting.map(esc).join(', '):'<br>Все три филиала сдали отчёты')+'</div></div>';
}
function homeIcon(name){
  const files={evening_report:'icons/01-evening-report.png',cash_acceptance:'icons/03-cash-acceptance.png',appointments:'icons/10-my-appointments.png',callcenter_shift:'icons/08-my-schedule.png',where_i_work:'icons/07-who-is-where.png',my_accruals:'icons/09-my-accruals.png',vaccines:'icons/05-vaccines.png',vaccines_all_branches:'icons/05-vaccines.png',dose_calculator:'icons/20-dose-calc.png',supplies:'icons/21-order.png',supplies_all_requests:'icons/06-drug-request.png',supply_order:'icons/21-order.png',head_money:'icons/14-revenue-director-only.png',head_reports:'icons/04-audit.png',head_cash_safe:'icons/19-safe.png',head_payroll:'icons/09-my-accruals.png',people_roles:'icons/12-employees.png'};
  if(files[name])return '<img src="'+files[name]+'" alt="">';
  return '';
}
const HOME_TILE_META={
  evening_report:{section:'finance',size:'main',title:'Вечерний отчёт',sub:'Закройте день — это пара минут',act:'homebranches'},
  cash_acceptance:{section:'finance',size:'wide',title:'Приём кассы',sub:'Утром: пересчитать и подтвердить',act:'homebranches'},
  appointments:{section:'clinic',size:'main',title:'Мои записи',sub:'Ближайшие приёмы и пациенты',view:'sched'},
  callcenter_shift:{section:'clinic',size:'main',title:'Мои смены',sub:'Отметки и итог колл-центра',view:'cc'},
  my_accruals:{section:'finance',size:'main',title:'Мои начисления',sub:'Начислено за текущий период',view:'work'},
  where_i_work:{section:'work',size:'wide',title:'Где я работаю',sub:'Мои смены и кто где сегодня',view:'sched'},
  vaccines:{section:'preparations',size:'sm',title:'Вакцины',sub:'Остатки и движение',prepare:'Здесь будут остатки вакцин и их движение по филиалам.'},
  vaccines_all_branches:{section:'preparations',size:'sm',title:'Вакцины по филиалам',sub:'Остатки во всех клиниках',prepare:'Здесь будут остатки вакцин по всем филиалам.'},
  dose_calculator:{section:'preparations',size:'sm',title:'Расчёт дозы',sub:'Быстрый расчёт препарата',prepare:'Здесь будет безопасный расчёт дозы препарата.'},
  supplies:{section:'preparations',size:'sm',title:'Препараты и расходники',sub:'Остатки и заявки',prepare:'Здесь будут остатки препаратов и заявки на расходники.'},
  supplies_all_requests:{section:'preparations',size:'sm',title:'Заявки филиалов',sub:'Все заявки на снабжение',prepare:'Здесь будут заявки филиалов на препараты и расходники.'},
  supply_order:{section:'preparations',size:'sm',title:'Заказ снабжения',sub:'Собрать и отметить заказ',prepare:'Здесь можно будет собрать и отметить заказ снабжения.'},
  head_money:{section:'finance',size:'main',title:'Деньги',sub:'Выручка, касса и сейфы всех филиалов',view:'rev'},
  head_reports:{section:'finance',size:'sm',title:'Отчёты',sub:'Контроль филиалов',view:'ctl'},
  head_cash_safe:{section:'finance',size:'sm',title:'Касса и сейф',sub:'Инкассации и выемки',view:'safe'},
  head_payroll:{section:'finance',size:'wide',title:'Зарплаты',sub:'Начисления и выплаты',view:'pay'},
  people_roles:{section:'clinic',size:'wide',title:'Люди и доступы',sub:'Сотрудники, роли и доступы',view:'ppl'}
};
function homeTileKeys(){
  const map=UI2.roleTiles||{},seen=new Set(),out=[];
  personRoles().forEach(role=>(map[role]||[]).forEach(k=>{if(!seen.has(k)&&HOME_TILE_META[k]){seen.add(k);out.push(k)}}));
  return out;
}
function homeTileHtml(k){
  const m=HOME_TILE_META[k],built=(UI2.moduleBuilt||{})[k]===true,attrs=built?(m.act?' data-act="'+m.act+'"':' data-act="go" data-v="'+m.view+'"'):' data-act="prepare" data-k="'+k+'"';
  return '<button class="glass ui2-role-tile '+m.size+'"'+attrs+'><span class="ic">'+homeIcon(k)+'</span><span><span class="t">'+esc(m.title)+'</span><span class="sub">'+esc(m.sub)+'</span></span></button>';
}
function homeSectionsHtml(){
  const names={finance:'Финансы',work:'Смена',preparations:'Препараты',clinic:'Клиника'},keys=homeTileKeys();
  return ['finance','preparations','work','clinic'].map(sec=>{const a=keys.filter(k=>HOME_TILE_META[k].section===sec);return a.length?'<div class="ui2-group-title">'+names[sec]+'</div><div class="ui2-role-tiles'+(a.length===1?' single':'')+'">'+a.map(homeTileHtml).join('')+'</div>':''}).join('');
}
function showHomeBranches(){
  const buttons=BRANCHES.filter(b=>!b.testOnly).map(b=>'<button class="ui2-branch branch-'+b.id+'" data-act="branch" data-id="'+b.id+'"'+(S.busy?' disabled':'')+'><span>'+esc(b.title)+'</span><small>Открыть отчёт и приём кассы</small></button>').join('');
  overlay('<h2>Выберите филиал</h2><p class="hint">Откроется сегодняшний отчёт. Утром сначала показывается приём кассы.</p>'+buttons+'<button class="btn sec small" data-act="ovclose">Отмена</button>');
}
function viewBranch(){
  if(isHead()){loadDayStatus();if(S.mr==null&&S.cash==null&&S.lv==null)loadMr()}else loadHomeWho();
  let h='<section class="ui2-home-screen"><div class="ui2-greeting"><small>'+esc(stageRole(S.person))+'</small><h1>'+esc(stageGreeting(S.person))+'</h1></div>'+(isHead()?headTodayHtml():homeTodayHtml())+homeSectionsHtml();
  if(isHead())h+='<div class="glass"><h2>Деньги в моменте</h2><div class="chips"><button class="btn small" data-act="transitpickup">Забрал с филиала</button><button class="btn sec small" data-act="go" data-v="safe">Взял из сейфа</button></div></div>';
  if(isHead())h+='<div class="mrbox">'+mrHtml()+'</div>'+dayStatusHtml()+headReportHtml();
  if(S.queue.length)h+='<div class="card quiet"><p class="hint">Не отправлено отчётов: '+S.queue.length+'. Нажмите «'+(S.online?'онлайн':'нет связи')+'» вверху.</p></div>';
  return h+'</section>';
}
function headReportHtml(){
  return '<div class="card"><h2>Отчёт филиала</h2><label class="f"><span>Дата</span><input id="dt" type="date" value="'+esc(S.date)+'"></label>'+BRANCHES.filter(b=>!b.testOnly).map(b=>'<button class="ui2-branch branch-'+b.id+'" data-act="branch" data-id="'+b.id+'"><span>'+esc(b.title)+'</span><small>Открыть отчёт</small></button>').join('')+'</div>';
}
function prepareHtml(){
  const m=HOME_TILE_META[S.prepareKey]||{title:'Раздел',prepare:'Этот раздел появится в одной из следующих тестовых сборок.'};
  return '<section class="ui2-home-screen"><div class="ui2-greeting"><small>'+esc(stageRole(S.person))+'</small><h1>Раздел готовится</h1></div><div class="glass ui2-prepare"><span class="ic">'+homeIcon(S.prepareKey)+'</span><h2>'+esc(m.title)+'</h2><p>'+esc(m.prepare||'Этот раздел появится в одной из следующих тестовых сборок.')+'</p><button class="btn" data-act="go" data-v="branch">На главную</button></div></section>';
}
