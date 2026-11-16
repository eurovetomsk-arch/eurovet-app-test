window.STAGE1=Object.freeze({"url": "https://txcibtcfuzqhhebeguby.supabase.co", "key": "sb_publishable_htkj5iw8Rfb4weCaRReFWg_cD3uYhMr"});
window.EVROVET_UI2_CONFIG=Object.freeze({
  roleLabels:Object.freeze({
    head:'Руководитель',
    admin:'Администратор',
    doctor:'Врач',
    assistant_clinical:'Клинический ассистент',
    assistant_tech:'Технический ассистент',
    callcenter:'Колл-центр',
    courier:'Специалист АХО'
  }),
  moduleBuilt:Object.freeze({
    evening_report:true,
    cash_acceptance:true,
    appointments:true,
    callcenter_shift:true,
    schedule:true,
    accruals:true,
    where_i_work:true,
    my_accruals:true,
    head_money:true,
    head_reports:true,
    head_cash_safe:true,
    head_payroll:true,
    people_roles:true,
    vaccines:false,
    vaccines_all_branches:false,
    vaccines_input:false,
    dose_calculator:false,
    supplies:false,
    supplies_all_requests:false,
    supply_order:false,
    modules_roles:false,
    birthdays:false
  }),
  roleTiles:Object.freeze({
    head:Object.freeze(['head_money','head_reports','head_cash_safe','head_payroll','supplies_all_requests','vaccines_all_branches','dose_calculator','people_roles']),
    admin:Object.freeze(['evening_report','cash_acceptance','vaccines','supplies']),
    doctor:Object.freeze(['appointments','vaccines','dose_calculator','supplies']),
    assistant_clinical:Object.freeze(['my_accruals','where_i_work','vaccines','dose_calculator','supplies']),
    assistant_tech:Object.freeze(['my_accruals','where_i_work','vaccines','dose_calculator','supplies']),
    callcenter:Object.freeze(['callcenter_shift','my_accruals','vaccines','where_i_work']),
    courier:Object.freeze(['my_accruals','vaccines_all_branches','supplies_all_requests','supply_order'])
  }),
  slogans:Object.freeze([
    'Ваша смена — наша забота',
    'Мы ценим вас каждый день',
    'Спасибо, что вы с нами',
    'Вы — сердце нашей клиники',
    'Мы рядом в каждой смене',
    'Вы делаете мир добрее',
    'С заботой о вашей работе',
    'Сделано для вас',
    'Ваша смена стала проще',
    'Всё под рукой — для вас'
  ]),
  sloganRotate:true,
  /* Семья (свод §14, слово Михаила 16.11): начисления считаются и видны, в «Остаток к выплате» сейфа (сколько наличных нужно) не входят.
     Номера людей из ev_people. Настройка клиники, не код: менять здесь. */
  /* Ведомость (свод §13): человек с двумя ролями стоит в одной группе — по основной роли.
     Порядок групп и исключения по человеку (номер -> роль). Смага (админ+врач) — администратор; КЦ, выходящий админом, — колл-центр; врач, выходящий ассистентом, — врач. */
  primaryRoleOrder:Object.freeze(['callcenter','admin','doctor','assistant','outsource']),
  primaryRoleByPerson:Object.freeze({}),
  cashExcludePersonIds:Object.freeze([1,6,17]),
  navByRole:Object.freeze({
    default:Object.freeze(['home','schedule','accruals','menu']),
    courier:Object.freeze(['home','accruals','menu']),
    head:Object.freeze(['rev','schedule','safe','ppl','menu'])
  })
});
