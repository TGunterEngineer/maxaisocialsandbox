
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS sms_bonus_credits integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.sms_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  credits integer NOT NULL,
  amount_cents integer,
  currency text,
  stripe_session_id text UNIQUE,
  environment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team managers can view sms topups"
  ON public.sms_topups FOR SELECT TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Service role manages sms topups"
  ON public.sms_topups FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_sms_topups_org ON public.sms_topups(organization_id, created_at DESC);

-- Idempotent credit grant. Returns the credits added (0 if session already processed).
CREATE OR REPLACE FUNCTION public.credit_sms_topup(
  _org_id uuid,
  _credits integer,
  _stripe_session_id text,
  _amount_cents integer DEFAULT NULL,
  _currency text DEFAULT NULL,
  _environment text DEFAULT NULL,
  _created_by uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF _credits IS NULL OR _credits <= 0 THEN
    RAISE EXCEPTION 'credits must be > 0';
  END IF;

  INSERT INTO public.sms_topups (organization_id, credits, amount_cents, currency, stripe_session_id, environment, created_by)
  VALUES (_org_id, _credits, _amount_cents, _currency, _stripe_session_id, _environment, _created_by)
  ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted THEN
    UPDATE public.organizations
       SET sms_bonus_credits = sms_bonus_credits + _credits,
           updated_at = now()
     WHERE id = _org_id;
    RETURN _credits;
  END IF;
  RETURN 0;
END;
$$;

-- Update can_send_sms: effective limit = base + bonus_credits
CREATE OR REPLACE FUNCTION public.can_send_sms(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       text;
  v_base_limit int;
  v_bonus      int;
  v_effective  int;
  v_used       int;
BEGIN
  v_plan       := public.get_org_plan_tier(_org_id);
  v_base_limit := public.get_plan_limit(v_plan, 'sms_month');
  v_used       := public.count_sms_this_month(_org_id);

  SELECT COALESCE(sms_bonus_credits, 0) INTO v_bonus
    FROM public.organizations WHERE id = _org_id;

  -- Unlimited plan (founder) — bonus credits are irrelevant.
  IF v_base_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', NULL,
                              'base_limit', NULL, 'bonus_credits', v_bonus);
  END IF;

  -- No active subscription. Bonus credits alone still let them send up to that balance.
  IF v_base_limit < 0 THEN
    v_effective := v_bonus;
    IF v_effective <= 0 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription',
                                'used', v_used, 'limit', 0, 'base_limit', 0, 'bonus_credits', v_bonus);
    END IF;
    IF v_used >= v_effective THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached',
                                'used', v_used, 'limit', v_effective, 'base_limit', 0, 'bonus_credits', v_bonus);
    END IF;
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_effective,
                              'base_limit', 0, 'bonus_credits', v_bonus);
  END IF;

  v_effective := v_base_limit + COALESCE(v_bonus, 0);

  IF v_used >= v_effective THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached',
                              'used', v_used, 'limit', v_effective,
                              'base_limit', v_base_limit, 'bonus_credits', v_bonus);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_effective,
                            'base_limit', v_base_limit, 'bonus_credits', v_bonus);
END;
$$;

-- Surface bonus credits + effective limit in get_org_usage so the UI can render them.
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
  v_elite      boolean;
  v_sms_base   int;
  v_bonus      int;
  v_sms_limit  int;
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

  v_sms_base := public.get_plan_limit(v_plan, 'sms_month');
  SELECT COALESCE(sms_bonus_credits, 0) INTO v_bonus FROM public.organizations WHERE id = _org_id;
  v_sms_limit := CASE
    WHEN v_sms_base IS NULL THEN NULL
    WHEN v_sms_base < 0 THEN v_bonus  -- no subscription: only bonus credits available
    ELSE v_sms_base + COALESCE(v_bonus, 0)
  END;

  RETURN jsonb_build_object(
    'plan_tier', v_plan,
    'has_elite_features', v_elite,
    'sms_bonus_credits', v_bonus,
    'contacts',  jsonb_build_object('used', v_contacts,  'limit', public.get_plan_limit(v_plan, 'contacts')),
    'locations', jsonb_build_object('used', v_locations, 'limit', public.get_plan_limit(v_plan, 'locations')),
    'seats',     jsonb_build_object('used', v_seats + v_invites, 'limit', public.get_plan_limit(v_plan, 'seats')),
    'sms_month', jsonb_build_object('used', v_sms_month, 'limit', v_sms_limit, 'base_limit', v_sms_base, 'bonus_credits', v_bonus)
  );
END;
$$;
