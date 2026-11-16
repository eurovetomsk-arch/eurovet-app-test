-- TEST ONLY: Supabase txcibtcfuzqhhebeguby.
-- Reject a bank registry when any employee has already been issued for the chosen period.
SET LOCAL ev.allow_ddl = 'on';

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
  IF v IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session');
  END IF;
  IF v = -1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ev_payroll_issued i
    WHERE i.period_from = p_from
      AND i.period_to = p_to
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period_issued');
  END IF;
  RETURN public.ev_payroll_paid_load(p_from, p_to, p_hash, p_rows);
END
$function$;
