CREATE INDEX IF NOT EXISTS idx_subscriptions_org_env_created
  ON public.subscriptions (organization_id, environment, created_at DESC);