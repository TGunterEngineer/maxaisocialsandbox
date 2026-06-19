
CREATE TABLE public.manual_refresh_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  location_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_refresh_log_org_day
  ON public.manual_refresh_log (organization_id, created_at DESC);

ALTER TABLE public.manual_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages manual refresh log"
  ON public.manual_refresh_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Team managers can view manual refresh log"
  ON public.manual_refresh_log FOR SELECT
  TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

-- Per-plan daily cap for manual review refreshes. NULL = unlimited.
CREATE OR REPLACE FUNCTION public.get_manual_refresh_limit(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _plan IN ('founder', 'premium') THEN NULL
    WHEN _plan = 'pro' THEN 3
    WHEN _plan = 'starter' THEN 1
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.check_manual_refresh_quota(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_limit int;
  v_used  int;
BEGIN
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_plan := public.get_org_plan_tier(_org_id);
  v_limit := public.get_manual_refresh_limit(v_plan);

  SELECT COUNT(*)::int INTO v_used
  FROM public.manual_refresh_log
  WHERE organization_id = _org_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  RETURN jsonb_build_object(
    'plan', v_plan,
    'used', v_used,
    'limit', v_limit,
    'allowed', v_limit IS NULL OR v_used < v_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_manual_refresh(_org_id uuid, _user_id uuid, _location_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_limit int;
  v_used  int;
BEGIN
  v_plan := public.get_org_plan_tier(_org_id);
  v_limit := public.get_manual_refresh_limit(v_plan);

  SELECT COUNT(*)::int INTO v_used
  FROM public.manual_refresh_log
  WHERE organization_id = _org_id
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  IF v_limit IS NOT NULL AND v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'plan', v_plan, 'used', v_used, 'limit', v_limit);
  END IF;

  INSERT INTO public.manual_refresh_log (organization_id, user_id, location_id)
  VALUES (_org_id, _user_id, _location_id);

  RETURN jsonb_build_object('allowed', true, 'plan', v_plan, 'used', v_used + 1, 'limit', v_limit);
END;
$$;
