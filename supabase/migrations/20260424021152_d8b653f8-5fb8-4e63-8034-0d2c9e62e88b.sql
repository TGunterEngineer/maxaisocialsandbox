-- Add 7-day trial fields to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');

-- Backfill existing rows so they don't get a fresh trial today
UPDATE public.organizations
   SET trial_started_at = COALESCE(trial_started_at, created_at),
       trial_ends_at    = COALESCE(trial_ends_at, created_at + interval '7 days')
 WHERE trial_started_at IS NULL OR trial_ends_at IS NULL;

-- Helper: is the org currently inside its 7-day trial window?
CREATE OR REPLACE FUNCTION public.is_org_in_trial(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _org_id
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at > now()
  );
$$;

-- During trial, treat the org as 'starter' so existing FeatureGate / plan-limit
-- triggers / sidebar logic transparently grant Starter-tier access.
CREATE OR REPLACE FUNCTION public.get_org_plan_tier(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
BEGIN
  SELECT plan_tier INTO v_tier
  FROM public.subscriptions
  WHERE organization_id = _org_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > now())
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_tier IS NOT NULL THEN
    RETURN v_tier;
  END IF;

  -- No paid sub: fall back to trial
  IF public.is_org_in_trial(_org_id) THEN
    RETURN 'starter';
  END IF;

  RETURN NULL;
END;
$$;

-- Trial counts as an active subscription for paywall purposes
CREATE OR REPLACE FUNCTION public.has_active_subscription(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = _org_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  ) OR public.is_org_in_trial(_org_id);
$$;

-- Expose trial status via get_org_usage so the client can show a banner
CREATE OR REPLACE FUNCTION public.get_org_usage(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       text;
  v_contacts   int;
  v_locations  int;
  v_seats      int;
  v_invites    int;
  v_sms_month  int;
  v_trial_ends timestamptz;
  v_in_trial   boolean;
BEGIN
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_plan := public.get_org_plan_tier(_org_id);

  SELECT trial_ends_at INTO v_trial_ends FROM public.organizations WHERE id = _org_id;
  v_in_trial := public.is_org_in_trial(_org_id);

  SELECT COUNT(*)::int INTO v_contacts  FROM public.contacts  WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_locations FROM public.locations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_seats     FROM public.user_organizations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_invites   FROM public.team_invitations
   WHERE organization_id = _org_id AND accepted_at IS NULL AND expires_at > now();
  v_sms_month := public.count_sms_this_month(_org_id);

  RETURN jsonb_build_object(
    'plan_tier', v_plan,
    'in_trial',  v_in_trial,
    'trial_ends_at', v_trial_ends,
    'contacts',  jsonb_build_object('used', v_contacts,  'limit', public.get_plan_limit(v_plan, 'contacts')),
    'locations', jsonb_build_object('used', v_locations, 'limit', public.get_plan_limit(v_plan, 'locations')),
    'seats',     jsonb_build_object('used', v_seats + v_invites, 'limit', public.get_plan_limit(v_plan, 'seats')),
    'sms_month', jsonb_build_object('used', v_sms_month, 'limit', public.get_plan_limit(v_plan, 'sms_month'))
  );
END;
$$;

-- New orgs get an automatic 7-day trial from creation
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _primary_color text DEFAULT '#3B82F6'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name required';
  END IF;

  INSERT INTO public.organizations (name, primary_color, trial_started_at, trial_ends_at)
  VALUES (trim(_name), COALESCE(_primary_color, '#3B82F6'), now(), now() + interval '7 days')
  RETURNING id INTO new_org_id;

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (auth.uid(), new_org_id, 'owner');

  RETURN new_org_id;
END;
$$;

-- Same for the auto-created org via handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  display_name TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Workspace');
  display_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', '');

  INSERT INTO public.organizations (name, trial_started_at, trial_ends_at)
  VALUES (org_name, now(), now() + interval '7 days')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES (NEW.id, new_org_id, display_name);

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  RETURN NEW;
END;
$$;