CREATE OR REPLACE FUNCTION public.get_org_plan_tier(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier text;
BEGIN
  IF public.is_super_admin() THEN
    RETURN 'founder';
  END IF;

  SELECT plan_tier INTO v_tier
  FROM public.subscriptions
  WHERE organization_id = _org_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > now())
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN v_tier;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE organization_id = _org_id
        AND status IN ('active', 'trialing')
        AND (current_period_end IS NULL OR current_period_end > now())
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_org_subscription_summary(_org_id uuid)
RETURNS TABLE(id uuid, status text, plan_tier text, price_id text, cancel_at_period_end boolean, current_period_end timestamp with time zone, founder_slot_number integer, environment text, updated_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin() THEN
    RETURN QUERY
      SELECT gen_random_uuid(), 'active'::text, 'founder'::text, NULL::text, false, NULL::timestamptz, NULL::integer, 'sandbox'::text, now()
      UNION ALL
      SELECT gen_random_uuid(), 'active'::text, 'founder'::text, NULL::text, false, NULL::timestamptz, NULL::integer, 'live'::text, now();
    RETURN;
  END IF;

  RETURN QUERY
    SELECT s.id, s.status, s.plan_tier, s.price_id, s.cancel_at_period_end,
           s.current_period_end, s.founder_slot_number, s.environment, s.updated_at
    FROM public.subscriptions s
    WHERE s.organization_id = _org_id
      AND public.is_org_member(auth.uid(), _org_id)
    ORDER BY s.updated_at DESC
    LIMIT 1;
END;
$function$;