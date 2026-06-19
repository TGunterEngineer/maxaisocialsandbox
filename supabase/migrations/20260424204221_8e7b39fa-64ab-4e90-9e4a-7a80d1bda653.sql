-- Tighten subscriptions visibility: only team managers (owner/admin) can SELECT raw rows.
-- Regular members get a safe summary via SECURITY DEFINER RPC (no Stripe IDs).

DROP POLICY IF EXISTS "Org members can view subscriptions" ON public.subscriptions;

CREATE POLICY "Team managers can view subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

-- Safe summary for any org member: excludes stripe_customer_id and stripe_subscription_id.
CREATE OR REPLACE FUNCTION public.get_org_subscription_summary(_org_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  plan_tier text,
  price_id text,
  cancel_at_period_end boolean,
  current_period_end timestamptz,
  founder_slot_number integer,
  environment text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.status, s.plan_tier, s.price_id, s.cancel_at_period_end,
         s.current_period_end, s.founder_slot_number, s.environment, s.updated_at
  FROM public.subscriptions s
  WHERE s.organization_id = _org_id
    AND public.is_org_member(auth.uid(), _org_id)
  ORDER BY s.updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_subscription_summary(uuid) TO authenticated;