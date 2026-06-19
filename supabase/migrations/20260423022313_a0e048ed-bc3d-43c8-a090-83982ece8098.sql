-- ============================================================
-- Plan limits enforcement
-- ============================================================

-- Returns the active plan tier for an org (or NULL if no active sub)
CREATE OR REPLACE FUNCTION public.get_org_plan_tier(_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan_tier
  FROM public.subscriptions
  WHERE organization_id = _org_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > now())
  ORDER BY updated_at DESC
  LIMIT 1
$$;

-- Returns the numeric cap for (plan, resource). NULL = unlimited. -1 = blocked.
CREATE OR REPLACE FUNCTION public.get_plan_limit(_plan text, _resource text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _plan = 'founder' THEN NULL  -- unlimited
    WHEN _plan = 'pro' THEN
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
    ELSE -1  -- no subscription / unknown plan: blocked
  END
$$;

-- Counts SMS sends in the current calendar month for an org
CREATE OR REPLACE FUNCTION public.count_sms_this_month(_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::int, 0)
  FROM public.sms_send_log
  WHERE organization_id = _org_id
    AND status = 'sent'
    AND created_at >= date_trunc('month', now())
$$;

-- Single-call usage report used by the UI
CREATE OR REPLACE FUNCTION public.get_org_usage(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT COUNT(*)::int INTO v_contacts
    FROM public.contacts WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_locations
    FROM public.locations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_seats
    FROM public.user_organizations WHERE organization_id = _org_id;
  SELECT COUNT(*)::int INTO v_invites
    FROM public.team_invitations
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
$$;

-- Server-side check used by send-sms edge function
CREATE OR REPLACE FUNCTION public.can_send_sms(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_limit int;
  v_used  int;
BEGIN
  v_plan  := public.get_org_plan_tier(_org_id);
  v_limit := public.get_plan_limit(v_plan, 'sms_month');
  v_used  := public.count_sms_this_month(_org_id);

  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', NULL);
  END IF;
  IF v_limit < 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription', 'used', v_used, 'limit', 0);
  END IF;
  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'used', v_used, 'limit', v_limit);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit);
END;
$$;

-- ============================================================
-- Triggers: enforce caps at insert time
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_contacts_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_limit int;
  v_used  int;
BEGIN
  v_plan  := public.get_org_plan_tier(NEW.organization_id);
  v_limit := public.get_plan_limit(v_plan, 'contacts');
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  IF v_limit < 0 THEN
    RAISE EXCEPTION 'plan_limit:no_subscription:contacts'
      USING HINT = 'An active subscription is required to add contacts.';
  END IF;
  SELECT COUNT(*)::int INTO v_used FROM public.contacts WHERE organization_id = NEW.organization_id;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'plan_limit:contacts:%:%', v_used, v_limit
      USING HINT = 'Contact limit reached for your plan. Upgrade to add more.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_locations_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_limit int;
  v_used  int;
BEGIN
  v_plan  := public.get_org_plan_tier(NEW.organization_id);
  v_limit := public.get_plan_limit(v_plan, 'locations');
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  IF v_limit < 0 THEN
    RAISE EXCEPTION 'plan_limit:no_subscription:locations'
      USING HINT = 'An active subscription is required to add locations.';
  END IF;
  SELECT COUNT(*)::int INTO v_used FROM public.locations WHERE organization_id = NEW.organization_id;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'plan_limit:locations:%:%', v_used, v_limit
      USING HINT = 'Location limit reached for your plan. Upgrade to add more.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_seats_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_limit int;
  v_used  int;
  v_invites int;
BEGIN
  v_plan  := public.get_org_plan_tier(NEW.organization_id);
  v_limit := public.get_plan_limit(v_plan, 'seats');
  IF v_limit IS NULL THEN RETURN NEW; END IF;
  IF v_limit < 0 THEN
    RAISE EXCEPTION 'plan_limit:no_subscription:seats'
      USING HINT = 'An active subscription is required to add team members.';
  END IF;
  SELECT COUNT(*)::int INTO v_used    FROM public.user_organizations WHERE organization_id = NEW.organization_id;
  SELECT COUNT(*)::int INTO v_invites FROM public.team_invitations
    WHERE organization_id = NEW.organization_id AND accepted_at IS NULL AND expires_at > now();
  IF (v_used + v_invites) >= v_limit THEN
    RAISE EXCEPTION 'plan_limit:seats:%:%', (v_used + v_invites), v_limit
      USING HINT = 'Team seat limit reached for your plan. Upgrade to invite more.';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop & recreate triggers (idempotent)
DROP TRIGGER IF EXISTS trg_enforce_contacts_limit  ON public.contacts;
DROP TRIGGER IF EXISTS trg_enforce_locations_limit ON public.locations;
DROP TRIGGER IF EXISTS trg_enforce_invites_limit   ON public.team_invitations;
DROP TRIGGER IF EXISTS trg_enforce_members_limit   ON public.user_organizations;

CREATE TRIGGER trg_enforce_contacts_limit
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contacts_limit();

CREATE TRIGGER trg_enforce_locations_limit
  BEFORE INSERT ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_locations_limit();

CREATE TRIGGER trg_enforce_invites_limit
  BEFORE INSERT ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seats_limit();

CREATE TRIGGER trg_enforce_members_limit
  BEFORE INSERT ON public.user_organizations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seats_limit();