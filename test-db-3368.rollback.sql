-- Откат 3367/3368 на тестовой базе. Применять только отдельным решением.
drop trigger if exists ev_collection_reconcile_report on public.ev_reports;
drop function if exists public.ev_collection_reconcile_report();
drop function if exists public.ev_collection_handoff(text,text,numeric,text,text);
drop function if exists public.ev_collection_pickup(text,text,numeric,text);
drop function if exists public.ev_collection_transit_list(text,text,date);
drop function if exists public.ev_safe_out_add_v2(text,numeric,date,text,text,text);
drop function if exists public.ev_my_cash_today(text);
drop table if exists public.ev_collection_transit;
alter table public.ev_safe_out drop column if exists purpose;
