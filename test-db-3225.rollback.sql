-- TEST ONLY rollback: restore both functions to their state after task 3224.
SET LOCAL ev.allow_ddl = 'on';

CREATE OR REPLACE FUNCTION public.ev_mu_batches(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v bigint := public.ev__mu_head(p_token);
BEGIN
  IF v IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'session'); END IF;
  IF v = -1 THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'vm', COALESCE((SELECT jsonb_agg(x ORDER BY (x ->> 'id')::bigint DESC) FROM (
      SELECT jsonb_build_object('id', b.id, 'branch', b.branch_id, 'from', b.period_from, 'to', b.period_to, 'file', b.file_name,
        'rows', (SELECT count(*) FROM public.ev_payroll_accrual a WHERE a.batch_id = b.id),
        'total', (SELECT COALESCE(sum(a.amount), 0) FROM public.ev_payroll_accrual a WHERE a.batch_id = b.id),
        'at', b.loaded_at, 'cancelled', b.cancelled_at IS NOT NULL) x
      FROM public.ev_payroll_batch b ORDER BY b.id DESC LIMIT 30
    ) q), '[]'::jsonb),
    'bank', COALESCE((SELECT jsonb_agg(x ORDER BY (x ->> 'at') DESC) FROM (
      SELECT jsonb_build_object('hash', g.source_hash, 'from', g.pf, 'to', g.pt, 'rows', g.n, 'total', g.s, 'date', g.d,
        'at', g.at, 'who', g.who, 'cancelled', g.c) x
      FROM (
        SELECT p.source_hash, min(p.period_from) pf, min(p.period_to) pt, count(*) n, sum(p.amount) s, min(p.pay_date) d,
          max(p.loaded_at) at, bool_and(p.cancelled_at IS NOT NULL) c,
          (array_agg(pe.short_name ORDER BY pe.short_name))[1:4] who
        FROM public.ev_payroll_paid p JOIN public.ev_people pe ON pe.id = p.person_id
        WHERE p.source_hash IS NOT NULL GROUP BY p.source_hash ORDER BY max(p.loaded_at) DESC LIMIT 30
      ) g
    ) q), '[]'::jsonb)
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.ev_mu_load_bank(
  p_token text,
  p_from date,
  p_to date,
  p_hash text,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v bigint := public.ev__mu_head(p_token);
BEGIN
  IF v IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'session'); END IF;
  IF v = -1 THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF EXISTS (
    SELECT 1 FROM public.ev_payroll_issued i
    WHERE i.period_from = p_from AND i.period_to = p_to
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period_issued');
  END IF;
  RETURN public.ev_payroll_paid_load(p_from, p_to, p_hash, p_rows);
END
$function$;
