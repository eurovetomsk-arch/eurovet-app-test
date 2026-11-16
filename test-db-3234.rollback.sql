-- Rollback for test-db-3234.sql. Test project only.
set local ev.allow_ddl = 'on';
drop function if exists public.ev__cc_salary(date,date,boolean);
alter function public.ev__cc_salary_reports(date,date,boolean) rename to ev__cc_salary;
drop function if exists public.ev_mu_cc_val(text,date,date,numeric,text,boolean);
drop function if exists public.ev_cc_val_state(text,date,date);
drop function if exists public.ev__cc_period_valid(date,date);
drop table if exists public.ev_cc_period_val;

do $do$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ev_salary'
   order by p.oid limit 1;
  execute v_def;
end
$do$;
