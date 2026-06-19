-- Remove free trial functionality

-- 1. Update handle_new_user trigger function to not set trial dates
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  display_name TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Workspace');
  display_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', '');

  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES (NEW.id, new_org_id, display_name);

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');

  RETURN NEW;
END;
$function$;

-- 2. Update create_organization to not set trial dates
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _primary_color text DEFAULT '#3B82F6'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name required';
  END IF;

  INSERT INTO public.organizations (name, primary_color)
  VALUES (trim(_name), COALESCE(_primary_color, '#3B82F6'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (auth.uid(), new_org_id, 'owner');

  RETURN new_org_id;
END;
$function$;

-- 3. Update get_org_plan_tier to remove trial fallback
CREATE OR REPLACE FUNCTION public.get_org_plan_tier(_org_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  RETURN v_tier;
END;
$function$;

-- 4. Update has_active_subscription to remove trial fallback
CREATE OR REPLACE FUNCTION public.has_active_subscription(_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = _org_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$function$;

-- 5. Update get_org_usage to drop trial fields
CREATE OR REPLACE FUNCTION public.get_org_usage(_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan       text;
  v_contacts   int;
  v_locations  int;
  v_seats      int;
  v_invites    int;
  v_sms_month  int;
BEGIN
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_plan := public.get_org_plan_tier(_org_id);

  SELECT COUNT(*)::int INTO v_contacts  FROM public.contacts  WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_locations FROM public.locations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_seats     FROM public.user_organizations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_invites   FROM public.team_invitations
   WHERE organization_id = _org_id AND accepted_at IS NULL AND expires_at > now();
  v_sms_month := public.count_sms_this_month(_org_id);

  RETURN jsonb_build_object(
    'plan_tier', v_plan,
    'contacts',  jsonb_build_object('used', v_contacts,  'limit', public.get_plan_limit(v_plan, 'contacts')),
    'locations', jsonb_build_object('used', v_locations, 'limit', public.get_plan_limit(v_plan, 'locations')),
    'seats',     jsonb_build_object('used', v_seats + v_invites, 'limit', public.get_plan_limit(v_plan, 'seats')),
    'sms_month', jsonb_build_object('used', v_sms_month, 'limit', public.get_plan_limit(v_plan, 'sms_month'))
  );
END;
$function$;

-- 6. Drop is_org_in_trial function (no longer needed)
DROP FUNCTION IF EXISTS public.is_org_in_trial(uuid);

-- 7. Drop trial columns from organizations
ALTER TABLE public.organizations DROP COLUMN IF EXISTS trial_started_at;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS trial_ends_at;
