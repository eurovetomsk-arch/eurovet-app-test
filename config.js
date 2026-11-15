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
    head_money:true,
    head_reports:true,
    head_cash_safe:true,
    head_payroll:true,
    vaccines_stock:false,
    vaccines_all_branches:false,
    vaccines_input:false,
    dose_calculator:false,
    supplies:false,
    supplies_all_requests:false,
    supply_order:false,
    people_roles:false,
    modules_roles:false,
    birthdays:false
  }),
  roleTiles:Object.freeze({
    head:Object.freeze(['head_money','head_reports','head_cash_safe','head_payroll']),
    admin:Object.freeze(['evening_report','cash_acceptance','vaccines_stock','vaccines_input','supplies']),
    doctor:Object.freeze(['appointments','vaccines_stock','dose_calculator','supplies']),
    assistant_clinical:Object.freeze(['vaccines_stock','dose_calculator','supplies']),
    assistant_tech:Object.freeze(['vaccines_stock','dose_calculator','supplies']),
    callcenter:Object.freeze(['callcenter_shift','vaccines_stock']),
    courier:Object.freeze(['vaccines_all_branches','supplies_all_requests','supply_order'])
  }),
  navByRole:Object.freeze({
    default:Object.freeze(['home','schedule','accruals','menu']),
    courier:Object.freeze(['home','accruals','menu'])
  })
});
