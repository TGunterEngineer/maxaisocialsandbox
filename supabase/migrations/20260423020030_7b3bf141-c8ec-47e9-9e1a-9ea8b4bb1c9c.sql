-- Track Stripe subscriptions per organization
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  price_id TEXT,
  product_id TEXT,
  plan_tier TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete',
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  current_period_end TIMESTAMPTZ,
  founder_slot_number INTEGER UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service role can manage subscriptions"
ON public.subscriptions FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track founder slot allocation atomically (max 10)
CREATE TABLE public.founder_slots (
  slot_number INTEGER PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 10),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.founder_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view founder slots count"
ON public.founder_slots FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Service role can manage founder slots"
ON public.founder_slots FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Atomic slot claim: returns slot number (1-10) or NULL if full
CREATE OR REPLACE FUNCTION public.claim_founder_slot(_org_id UUID, _user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing INTEGER;
  v_next INTEGER;
BEGIN
  SELECT slot_number INTO v_existing FROM public.founder_slots WHERE organization_id = _org_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT COALESCE(MIN(s), NULL) INTO v_next
  FROM generate_series(1, 10) s
  WHERE s NOT IN (SELECT slot_number FROM public.founder_slots);

  IF v_next IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.founder_slots (slot_number, organization_id, user_id)
  VALUES (v_next, _org_id, _user_id)
  ON CONFLICT (organization_id) DO NOTHING
  RETURNING slot_number INTO v_existing;

  RETURN COALESCE(v_existing, v_next);
END;
$$;

-- Helper: check if an org has active access
CREATE OR REPLACE FUNCTION public.has_active_subscription(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = _org_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;

-- Public view of remaining founder slots (no auth required for marketing)
CREATE OR REPLACE FUNCTION public.get_founder_slots_remaining()
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 10 - COUNT(*)::INTEGER FROM public.founder_slots;
$$;

GRANT EXECUTE ON FUNCTION public.get_founder_slots_remaining() TO anon, authenticated;