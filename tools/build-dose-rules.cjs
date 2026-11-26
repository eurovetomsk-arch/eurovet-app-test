'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const clinical='/Users/agent/Documents/Codex/2026-11-05/evrovet-clinical/outputs/dose-calculator-v1/segments';
const inputs=[
  {file:'medical-41-78.json',sha256:'3b4a07bfe5f9056940951a7f3dedd43c6d9c029e7a6cd1e097ff9a3dc95a217a',prefix:'MED',offset:0},
  {file:'veterinary-1-29.json',sha256:'7e82e05ce1a5534397c4f2f4fcc8f041f39f6c74f3980a7b16a8e0e598c9b97b',prefix:'VET',offset:0}
];
const sourceItems=new Map();
for(const src of inputs){
  const p=path.join(clinical,src.file),raw=fs.readFileSync(p),sha=crypto.createHash('sha256').update(raw).digest('hex');
  if(sha!==src.sha256)throw Error(src.file+': SHA mismatch '+sha);
  for(const x of JSON.parse(raw))sourceItems.set(src.prefix+'-'+String(x.no+src.offset).padStart(3,'0'),x);
}
const route=(id,label)=>({id,label});
const shared={mode:'single_dose_liquid',amount_unit:'mg',basis:'kg',volume_unit:'ml',rounding:'display_only_3_decimals_no_device_rounding'};
const rule=(item_id,species,opt)=>({item_id,id:item_id+'-'+species+'-'+opt.code,species,...shared,...opt});
const rules=[
  rule('VET-001','dog',{code:'allergy',indication:'Аллергические реакции и другие показания инструкции',concentration_mg_ml:'10',dose_min_mg_kg:'2',dose_max_mg_kg:'2',routes:[route('SC','Подкожно'),route('IM','Внутримышечно')],frequency:'3 раза в сутки',source_ids:['V01'],warnings_short:['Не смешивать с несовместимыми препаратами.','Учитывать противопоказания из инструкции.']}),
  rule('VET-001','cat',{code:'allergy',indication:'Аллергические реакции и другие показания инструкции',concentration_mg_ml:'10',dose_min_mg_kg:'1',dose_max_mg_kg:'2',routes:[route('SC','Подкожно'),route('IM','Внутримышечно')],frequency:'2–3 раза в сутки',source_ids:['V01'],warnings_short:['Дозу внутри диапазона выбирает врач.','Учитывать противопоказания из инструкции.']}),
  ...['dog','cat'].map(s=>rule('MED-043',s,{code:'bolus',indication:'Противорвотный/прокинетический режим, без механической непроходимости',concentration_mg_ml:'5',dose_min_mg_kg:'0.1',dose_max_mg_kg:'0.5',routes:[route('IM','Внутримышечно'),route('SC','Подкожно')],frequency:'Каждые 6–8 часов',source_ids:['S4','S5'],warnings_short:['Не применять при механической непроходимости, перфорации или ЖКТ-кровотечении.','CRI в этот быстрый расчёт не входит.']})),
  ...['dog','cat'].map(s=>rule('MED-051',s,{code:'antiemetic',indication:'Противорвотная терапия',concentration_mg_ml:'2',dose_min_mg_kg:'0.1',dose_max_mg_kg:'0.15',routes:[route('IV_SLOW','Медленно внутривенно')],frequency:'Каждые 8–12 часов',source_ids:['S5'],warnings_short:['Осторожно при риске удлинения QT и тяжёлой печёночной недостаточности.']})),
  ...['dog','cat'].map(s=>rule('MED-056',s,{code:'nm_block_reversal',indication:'Реверсия недеполяризующего нейромышечного блока',concentration_mg_ml:'0.5',dose_min_mg_kg:'0.02',dose_max_mg_kg:'0.04',routes:[route('IV','Внутривенно')],frequency:'Однократно',source_ids:['S9'],risk:'high',warnings_short:['Только с или после утверждённой дозы атропина/гликопирролата.','Обязателен мониторинг; это не универсальная прокинетическая схема.']})),
  rule('VET-014','dog',{code:'acute_pain_im',indication:'Острая и послеоперационная боль',concentration_mg_ml:'10',dose_min_mg_kg:'1',dose_max_mg_kg:'2',routes:[route('IM','Внутримышечно')],frequency:'Каждые 4–6 часов по необходимости',source_ids:['V15'],warnings_short:['Только для собак.','Медленный внутривенный режим требует отдельного расчёта разведения и здесь не выдаётся.']}),
  rule('VET-023','dog',{code:'blood_parasites',indication:'Лечение или профилактика кровепаразитарных болезней по инструкции',concentration_mg_ml:'120',dose_min_mg_kg:'6',dose_max_mg_kg:'6',routes:[route('SC','Подкожно'),route('IM','Внутримышечно')],frequency:'Однократно; повтор через 24–48 часов только по клиническим показаниям',source_ids:['V25'],max_per_site_ml:'2',warnings_short:['Только для собак; наблюдать не менее 15 минут после инъекции.','Не более 2 мл в одно место введения.']}),
  ...['dog','cat'].map(s=>rule('VET-026',s,{code:'sensitive_infection',indication:'Чувствительная бактериальная инфекция по инструкции',concentration_mg_ml:'50',dose_min_mg_kg:'5',dose_max_mg_kg:'10',routes:[route('IM','Внутримышечно')],frequency:'1 раз в 24 часа, курс 5–7 дней',source_ids:['V29'],warnings_short:['Дозу внутри диапазона выбирает врач.','Перед назначением проверить противопоказания и лекарственные взаимодействия.']})),
  ...['dog','cat'].map(s=>rule('VET-027',s,{code:'pain_im',indication:'Умеренная/сильная, послеоперационная или травматическая боль',concentration_mg_ml:'50',dose_min_mg_kg:'2',dose_max_mg_kg:'4',routes:[route('IM','Внутримышечно')],frequency:s==='dog'?'Однократно или каждые 6–8 часов':'Однократно или каждые 8–12 часов',source_ids:['V30'],max_daily_mg_kg:s==='dog'?'16':'12',risk:'controlled',warnings_short:['Рецептурный/контролируемый препарат.','Учитывать все введения за последние 24 часа и суточный предел.']}))
];
const allowedStatuses=new Set(['verified','verified_draft_source_mirror','verified_dog_only','verified_controlled_daily_max']);
for(const r of rules){
  const src=sourceItems.get(r.item_id);if(!src)throw Error(r.item_id+': source item missing');
  if(!allowedStatuses.has(src.status))throw Error(r.item_id+': source status '+src.status+' is not calculable');
  if(!(Number(r.concentration_mg_ml)>0&&Number(r.dose_min_mg_kg)>0&&Number(r.dose_max_mg_kg)>=Number(r.dose_min_mg_kg)))throw Error(r.id+': bad numeric contract');
  if(!r.routes.length||!r.frequency||!r.indication)throw Error(r.id+': incomplete rule');
}
const payload={schema:'evrovet.dose_rules_test/v1',test_only:true,clinical_status:'DRAFT_FOR_PHYSICIAN_USABILITY_TEST_ONLY',generated_on:'2026-11-26',source_hashes:Object.fromEntries(inputs.map(x=>[x.file,x.sha256])),calculation_policy:{select_dose_by_physician:true,no_default_for_ranges:true,no_device_rounding:true,one_administration_only:true},rules};
const out=path.join(root,'data/dose-rules-v1.json'),body=JSON.stringify(payload);
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,body+'\n');
console.log(JSON.stringify({rules:rules.length,items:new Set(rules.map(x=>x.item_id)).size,bytes:Buffer.byteLength(body),sha256:crypto.createHash('sha256').update(body+'\n').digest('hex')},null,2));
