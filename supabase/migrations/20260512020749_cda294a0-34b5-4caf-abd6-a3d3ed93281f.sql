-- 1. Add the premium-plus flag to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_premium_plus boolean NOT NULL DEFAULT false;

-- 2. Helper: does this org get top-tier elite features (webhooks, advanced branding)?
--    Founder => always yes. Premium => only if is_premium_plus = true. Others => no.
--    Super admin always yes.
CREATE OR REPLACE FUNCTION public.org_has_elite_features(_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier text;
  v_flag boolean;
BEGIN
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  v_tier := public.get_org_plan_tier(_org_id);
  IF v_tier = 'founder' THEN
    RETURN true;
  END IF;

  IF v_tier = 'premium' THEN
    SELECT is_premium_plus INTO v_flag FROM public.organizations WHERE id = _org_id;
    RETURN COALESCE(v_flag, false);
  END IF;

  RETURN false;
END;
$$;

-- 3. Update get_org_plan_tier so it explicitly preserves 'premium' as its own tier
--    (it already returns the raw plan_tier; this rewrite makes the contract explicit
--    and documents that 'premium' is NOT silently upgraded to 'founder' anywhere).
CREATE OR REPLACE FUNCTION public.get_org_plan_tier(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Premium is a distinct tier from Founder. Elite-only features must additionally
  -- check public.org_has_elite_features(_org_id) (gated by organizations.is_premium_plus).
  RETURN v_tier;
END;
$$;

-- 4. Make plan-limit helper aware of 'premium' so premium subs aren't treated as
--    "no subscription" (-1). Premium gets pro-equivalent quotas.
CREATE OR REPLACE FUNCTION public.get_plan_limit(_plan text, _resource text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _plan = 'founder' THEN NULL
    WHEN _plan IN ('pro', 'premium') THEN
      CASE _resource
        WHEN 'contacts'   THEN 5000
        WHEN 'sms_month'  THEN 2000
        WHEN 'locations'  THEN 10
        WHEN 'seats'      THEN 10
        ELSE NULL
      END
    WHEN _plan = 'starter' THEN
      CASE _resource
        WHEN 'contacts'   THEN 500
        WHEN 'sms_month'  THEN 200
        WHEN 'locations'  THEN 1
        WHEN 'seats'      THEN 2
        ELSE NULL
      END
    ELSE -1
  END
$$;

-- 5. Surface the elite-features flag through get_org_usage so the frontend can gate UI.
CREATE OR REPLACE FUNCTION public.get_org_usage(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan       text;
  v_contacts   int;
  v_locations  int;
  v_seats      int;
  v_invites    int;
  v_sms_month  int;
  v_elite      boolean;
BEGIN
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_plan  := public.get_org_plan_tier(_org_id);
  v_elite := public.org_has_elite_features(_org_id);

  SELECT COUNT(*)::int INTO v_contacts  FROM public.contacts  WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_locations FROM public.locations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_seats     FROM public.user_organizations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_invites   FROM public.team_invitations
   WHERE organization_id = _org_id AND accepted_at IS NULL AND expires_at > now();
  v_sms_month := public.count_sms_this_month(_org_id);

  RETURN jsonb_build_object(
    'plan_tier', v_plan,
    'has_elite_features', v_elite,
    'contacts',  jsonb_build_object('used', v_contacts,  'limit', public.get_plan_limit(v_plan, 'contacts')),
    'locations', jsonb_build_object('used', v_locations, 'limit', public.get_plan_limit(v_plan, 'locations')),
    'seats',     jsonb_build_object('used', v_seats + v_invites, 'limit', public.get_plan_limit(v_plan, 'seats')),
    'sms_month', jsonb_build_object('used', v_sms_month, 'limit', public.get_plan_limit(v_plan, 'sms_month'))
  );
END;
$$;

-- 6. Server-side guard: block creating webhook endpoints unless org has elite features.
CREATE OR REPLACE FUNCTION public.create_webhook_endpoint(_org_id uuid, _name text, _url text, _event_type text DEFAULT 'rating.submitted'::text)
RETURNS TABLE(id uuid, name text, url text, event_type text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, signing_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.webhook_endpoints%ROWTYPE;
  v_secret text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_manage_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorized to manage webhooks';
  END IF;

  IF NOT public.org_has_elite_features(_org_id) THEN
    RAISE EXCEPTION 'plan_limit:elite_required:webhooks'
      USING HINT = 'Webhooks require the Founder tier or Premium+ add-on.';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Webhook name required';
  END IF;

  IF _url IS NULL OR length(trim(_url)) = 0 THEN
    RAISE EXCEPTION 'Webhook URL required';
  END IF;

  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.webhook_endpoints (organization_id, name, url, event_type, created_by)
  VALUES (_org_id, trim(_name), trim(_url), COALESCE(NULLIF(trim(_event_type), ''), 'rating.submitted'), auth.uid())
  RETURNING * INTO v_row;

  INSERT INTO public.webhook_endpoint_secrets (endpoint_id, secret)
  VALUES (v_row.id, v_secret)
  ON CONFLICT (endpoint_id) DO UPDATE
  SET secret = EXCLUDED.secret,
      updated_at = now();

  RETURN QUERY SELECT
    v_row.id,
    v_row.name,
    v_row.url,
    v_row.event_type,
    v_row.is_active,
    v_row.created_at,
    v_row.updated_at,
    v_secret;
END;
$$;