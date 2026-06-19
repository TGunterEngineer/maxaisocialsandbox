-- Contacts: SMS consent
ALTER TABLE public.contacts
  ADD COLUMN sms_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sms_opted_in_at TIMESTAMPTZ;

-- Campaigns: channel
ALTER TABLE public.campaigns
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms'));

-- Recipients: phone snapshot
ALTER TABLE public.campaign_recipients
  ADD COLUMN phone TEXT;

-- SMS suppression list (org-scoped because numbers can route to many orgs sharing the same Twilio sender)
CREATE TABLE public.sms_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'stop',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage SMS suppressions"
  ON public.sms_suppressions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- SMS send log
CREATE TABLE public.sms_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  campaign_recipient_id UUID,
  recipient_phone TEXT NOT NULL,
  status TEXT NOT NULL,
  message_sid TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_log_org ON public.sms_send_log(organization_id, created_at DESC);

ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sms log"
  ON public.sms_send_log FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Service role can write sms log"
  ON public.sms_send_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Helper
CREATE OR REPLACE FUNCTION public.is_sms_suppressed(_phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.sms_suppressions WHERE phone = _phone);
$$;