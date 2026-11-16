-- TEST ONLY rollback: restore ev_mu_load_bank exactly as read before task 3224.
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
  RETURN public.ev_payroll_paid_load(p_from, p_to, p_hash, p_rows);
END
$function$;
