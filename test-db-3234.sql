-- Test-only candidate for archive task 3234.
-- Append-only manual gross for the call-center pool. Never apply to production.
set local ev.allow_ddl = 'on';

create table public.ev_cc_period_val (
  id bigint generated always as identity primary key,
  period_from date not null,
  period_to date not null,
  action text not null check (action in ('set', 'cancel')),
  amount numeric(14,2),
  created_by bigint not null references public.ev_people(id),
  created_at timestamptz not null default now(),
  client_uid text not null unique,
  cancels bigint references public.ev_cc_period_val(id),
  constraint ev_cc_period_val_amount_ck check (
    (action = 'set' and amount is not null and amount >= 0 and cancels is null)
    or (action = 'cancel' and amount is null and cancels is not null)
  )
);

create index ev_cc_period_val_period_idx
  on public.ev_cc_period_val(period_from, period_to, id desc);
create index ev_cc_period_val_created_by_idx
  on public.ev_cc_period_val(created_by);
create index ev_cc_period_val_cancels_idx
  on public.ev_cc_period_val(cancels) where cancels is not null;

alter table public.ev_cc_period_val enable row level security;
revoke all on table public.ev_cc_period_val from public, anon, authenticated;
revoke all on sequence public.ev_cc_period_val_id_seq from public, anon, authenticated;
grant select, insert on table public.ev_cc_period_val to service_role;
grant usage, select on sequence public.ev_cc_period_val_id_seq to service_role;

create or replace function public.ev__cc_period_valid(p_from date, p_to date)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $fn$
  select p_from is not null and p_to is not null and (
    (extract(day from p_from) = 1 and p_to = p_from + 14)
    or
    (extract(day from p_from) = 16 and p_to = (date_trunc('month', p_from) + interval '1 month - 1 day')::date)
  )
$fn$;

revoke all on function public.ev__cc_period_valid(date,date) from public, anon, authenticated;
grant execute on function public.ev__cc_period_valid(date,date) to service_role;

create or replace function public.ev_cc_val_state(p_token text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_pid bigint := public.ev__mu_head(p_token);
  v_rec record;
begin
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'session'); end if;
  if v_pid = -1 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if not public.ev__cc_period_valid(p_from, p_to) then
    return jsonb_build_object('ok', false, 'error', 'period');
  end if;

  select e.id, e.action, e.amount, e.created_at, e.created_by, p.short_name
    into v_rec
    from public.ev_cc_period_val e
    join public.ev_people p on p.id = e.created_by
   where e.period_from = p_from and e.period_to = p_to
   order by e.id desc
   limit 1;

  return jsonb_build_object(
    'ok', true,
    'from', p_from,
    'to', p_to,
    'source', case when v_rec.action = 'set' then 'manual' else 'reports' end,
    'manual', v_rec.action = 'set',
    'amount', case when v_rec.action = 'set' then v_rec.amount end,
    'event_id', v_rec.id,
    'created_at', v_rec.created_at,
    'created_by', v_rec.created_by,
    'created_by_name', v_rec.short_name,
    'closed', exists (
      select 1 from public.ev_payroll_issued i
       where i.period_from = p_from and i.period_to = p_to and i.paid_total is not null
    )
  );
end
$fn$;

revoke all on function public.ev_cc_val_state(text,date,date) from public, authenticated;
grant execute on function public.ev_cc_val_state(text,date,date) to anon, service_role;

create or replace function public.ev_mu_cc_val(
  p_token text,
  p_from date,
  p_to date,
  p_amount numeric,
  p_uid text,
  p_cancel boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_pid bigint := public.ev__mu_head(p_token);
  v_last public.ev_cc_period_val%rowtype;
  v_dup bigint;
begin
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'session'); end if;
  if v_pid = -1 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if not public.ev__cc_period_valid(p_from, p_to) then
    return jsonb_build_object('ok', false, 'error', 'period');
  end if;
  if p_uid is null or length(p_uid) < 8 or length(p_uid) > 80 then
    return jsonb_build_object('ok', false, 'error', 'uid');
  end if;
  if exists (
    select 1 from public.ev_payroll_issued i
     where i.period_from = p_from and i.period_to = p_to and i.paid_total is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if not coalesce(p_cancel, false) and (p_amount is null or p_amount < 0 or p_amount > 999999999.99) then
    return jsonb_build_object('ok', false, 'error', 'amount');
  end if;

  perform pg_advisory_xact_lock(hashtext('ev_cc_period_val'), (p_from - date '2000-01-01'));

  select id into v_dup from public.ev_cc_period_val where client_uid = p_uid;
  if v_dup is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'id', v_dup);
  end if;

  select * into v_last
    from public.ev_cc_period_val
   where period_from = p_from and period_to = p_to
   order by id desc
   limit 1;

  if coalesce(p_cancel, false) then
    if v_last.id is null or v_last.action <> 'set' then
      return jsonb_build_object('ok', false, 'error', 'not_manual');
    end if;
    insert into public.ev_cc_period_val(period_from, period_to, action, amount, created_by, client_uid, cancels)
    values (p_from, p_to, 'cancel', null, v_pid, p_uid, v_last.id);
  else
    insert into public.ev_cc_period_val(period_from, period_to, action, amount, created_by, client_uid)
    values (p_from, p_to, 'set', round(p_amount, 2), v_pid, p_uid);
  end if;

  insert into public.ev_access_log(person_id, action, ok, detail)
  values (v_pid, 'cc_period_val', true,
          p_from::text || '..' || p_to::text || ' ' || case when coalesce(p_cancel, false) then 'cancel' else 'set' end);

  return public.ev_cc_val_state(p_token, p_from, p_to);
end
$fn$;

revoke all on function public.ev_mu_cc_val(text,date,date,numeric,text,boolean) from public, authenticated;
grant execute on function public.ev_mu_cc_val(text,date,date,numeric,text,boolean) to anon, service_role;

-- Preserve the accepted report-based implementation as the fallback source.
alter function public.ev__cc_salary(date,date,boolean) rename to ev__cc_salary_reports;

create or replace function public.ev__cc_salary(p_from date, p_to date, p_test boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_base jsonb := public.ev__cc_salary_reports(p_from, p_to, p_test);
  v_rates jsonb := v_base -> 'rates';
  v_pool_rate numeric;
  v_shift_rate numeric;
  v_day jsonb;
  v_person jsonb;
  v_person_day jsonb;
  v_period jsonb;
  v_new_day jsonb;
  v_days jsonb := '[]'::jsonb;
  v_people jsonb := '[]'::jsonb;
  v_person_days jsonb;
  v_periods jsonb := '[]'::jsonb;
  v_sources jsonb := '[]'::jsonb;
  v_from date;
  v_to date;
  v_action text;
  v_amount numeric;
  v_by bigint;
  v_at timestamptz;
  v_by_name text;
  v_den numeric;
  v_day_cost numeric;
  v_ops numeric;
  v_pct numeric;
  v_pct_sum numeric;
  v_total numeric := 0;
begin
  if v_rates is null or jsonb_typeof(v_rates) <> 'object' then return v_base; end if;
  v_pool_rate := coalesce((v_rates ->> 'cc_pct_pool')::numeric, 0);
  v_shift_rate := coalesce((v_rates ->> 'cc_shift')::numeric, 0);

  for v_period in select value from jsonb_array_elements(coalesce(v_base -> 'periods', '[]'::jsonb)) loop
    v_from := (v_period ->> 'from')::date;
    v_to := (v_period ->> 'to')::date;
    select e.action, e.amount, e.created_by, e.created_at, p.short_name
      into v_action, v_amount, v_by, v_at, v_by_name
      from public.ev_cc_period_val e join public.ev_people p on p.id = e.created_by
     where e.period_from = v_from and e.period_to = v_to
     order by e.id desc limit 1;
    if v_action = 'set' then
      v_den := case when coalesce((v_period ->> 'provisional')::boolean, false)
                    then greatest((v_period ->> 'elapsed')::numeric, 1)
                    else greatest((v_period ->> 'cal_days')::numeric, 1) end;
      v_day_cost := v_amount * v_pool_rate / v_den;
      v_period := jsonb_set(v_period, '{val}', to_jsonb(v_amount), true);
      v_period := jsonb_set(v_period, '{pool}', to_jsonb(round(v_amount * v_pool_rate, 2)), true);
      v_period := jsonb_set(v_period, '{day_cost}', to_jsonb(round(v_day_cost, 2)), true);
      v_period := v_period || jsonb_build_object('source','manual','created_by',v_by,'created_by_name',v_by_name,'created_at',v_at);
      v_sources := v_sources || jsonb_build_array(jsonb_build_object('from',v_from,'to',v_to,'source','manual','amount',v_amount,'created_by',v_by,'created_by_name',v_by_name,'created_at',v_at));
    else
      v_period := v_period || jsonb_build_object('source','reports');
      v_sources := v_sources || jsonb_build_array(jsonb_build_object('from',v_from,'to',v_to,'source','reports'));
    end if;
    v_periods := v_periods || jsonb_build_array(v_period);
  end loop;

  for v_day in select value from jsonb_array_elements(coalesce(v_base -> 'days', '[]'::jsonb)) loop
    v_from := case when extract(day from (v_day ->> 'date')::date) <= 15
                   then date_trunc('month', (v_day ->> 'date')::date)::date
                   else date_trunc('month', (v_day ->> 'date')::date)::date + 15 end;
    v_to := case when extract(day from v_from) = 1 then v_from + 14
                 else (date_trunc('month', v_from) + interval '1 month - 1 day')::date end;
    select e.action, e.amount into v_action, v_amount
      from public.ev_cc_period_val e
     where e.period_from = v_from and e.period_to = v_to
     order by e.id desc limit 1;
    if v_action = 'set' then
      select case when coalesce((x ->> 'provisional')::boolean, false)
                  then greatest((x ->> 'elapsed')::numeric, 1)
                  else greatest((x ->> 'cal_days')::numeric, 1) end
        into v_den
        from jsonb_array_elements(v_periods) x
       where (x ->> 'from')::date = v_from and (x ->> 'to')::date = v_to;
      v_day_cost := v_amount * v_pool_rate / greatest(coalesce(v_den, 1), 1);
      v_ops := coalesce((v_day ->> 'ops')::numeric, 0);
      v_day := jsonb_set(v_day, '{day_cost}', to_jsonb(round(v_day_cost, 2)), true);
      v_day := jsonb_set(v_day, '{pay_each}', case when v_ops > 0 then to_jsonb(v_shift_rate + round(v_day_cost / v_ops, 2)) else 'null'::jsonb end, true);
      v_day := v_day || jsonb_build_object('val_source','manual');
    else
      v_day := v_day || jsonb_build_object('val_source','reports');
    end if;
    v_days := v_days || jsonb_build_array(v_day);
  end loop;

  for v_person in select value from jsonb_array_elements(coalesce(v_base -> 'people', '[]'::jsonb)) loop
    v_person_days := '[]'::jsonb;
    v_pct_sum := 0;
    for v_person_day in select value from jsonb_array_elements(coalesce(v_person -> 'days', '[]'::jsonb)) loop
      select value into v_new_day from jsonb_array_elements(v_days) where value ->> 'date' = v_person_day ->> 'date' limit 1;
      if v_new_day is not null then
        v_ops := greatest(coalesce((v_new_day ->> 'ops')::numeric, 1), 1);
        v_pct := round(coalesce((v_new_day ->> 'day_cost')::numeric, 0) / v_ops, 2);
        v_person_day := jsonb_set(v_person_day, '{pct_pay}', to_jsonb(v_pct), true);
        v_person_day := jsonb_set(v_person_day, '{pay}', to_jsonb(v_shift_rate + v_pct), true);
        v_person_day := jsonb_set(v_person_day, '{pct}', case when coalesce((v_new_day ->> 'val')::numeric, 0) > 0 then to_jsonb(round(v_pct / (v_new_day ->> 'val')::numeric, 6)) else to_jsonb(0::numeric) end, true);
      end if;
      v_pct_sum := v_pct_sum + coalesce((v_person_day ->> 'pct_pay')::numeric, 0);
      v_person_days := v_person_days || jsonb_build_array(v_person_day);
    end loop;
    v_person := jsonb_set(v_person, '{days}', v_person_days, true);
    v_person := jsonb_set(v_person, '{pct_pay}', to_jsonb(v_pct_sum), true);
    v_person := jsonb_set(v_person, '{total}', to_jsonb(coalesce((v_person ->> 'shift_pay')::numeric,0) + v_pct_sum + coalesce((v_person ->> 'adj')::numeric,0)), true);
    v_total := v_total + (v_person ->> 'total')::numeric;
    v_people := v_people || jsonb_build_array(v_person);
  end loop;

  v_base := jsonb_set(v_base, '{periods}', v_periods, true);
  v_base := jsonb_set(v_base, '{days}', v_days, true);
  v_base := jsonb_set(v_base, '{people}', v_people, true);
  v_base := jsonb_set(v_base, '{total}', to_jsonb(v_total), true);
  return v_base || jsonb_build_object('val_sources', v_sources);
end
$fn$;

revoke all on function public.ev__cc_salary(date,date,boolean) from public, anon, authenticated;
grant execute on function public.ev__cc_salary(date,date,boolean) to service_role;

-- Invalidate any cached PL/pgSQL plans so ev_salary resolves the new wrapper.
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
