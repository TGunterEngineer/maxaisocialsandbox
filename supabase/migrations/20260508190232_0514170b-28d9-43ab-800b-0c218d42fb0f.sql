CREATE OR REPLACE FUNCTION public.enforce_seats_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan  text;
  v_limit int;
  v_used  int;
  v_invites int;
BEGIN
  -- Allow the very first owner membership created during signup.
  -- Plan seat limits should only apply after an organization already has a member.
  IF NEW.role = 'owner' THEN
    SELECT COUNT(*)::int INTO v_used
    FROM public.user_organizations
    WHERE organization_id = NEW.organization_id;

    IF v_used = 0 THEN
      RETURN NEW;
    END IF;
  END IF;

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
$function$;