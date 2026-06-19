-- Webhook endpoints (per-org)
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'rating.submitted',
  secret TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_endpoints_org ON public.webhook_endpoints(organization_id, event_type) WHERE is_active = true;

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team managers can view webhooks"
  ON public.webhook_endpoints FOR SELECT TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can insert webhooks"
  ON public.webhook_endpoints FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Team managers can update webhooks"
  ON public.webhook_endpoints FOR UPDATE TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can delete webhooks"
  ON public.webhook_endpoints FOR DELETE TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE TRIGGER trg_webhook_endpoints_updated
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Webhook deliveries (audit log + retry queue)
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 4,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_response_status INT,
  last_response_body TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_pending
  ON public.webhook_deliveries(next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX idx_webhook_deliveries_org ON public.webhook_deliveries(organization_id, created_at DESC);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team managers can view deliveries"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE TRIGGER trg_webhook_deliveries_updated
  BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: enqueue a delivery for every active endpoint matching an event
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  _organization_id UUID,
  _event_type TEXT,
  _payload JSONB
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_endpoint RECORD;
BEGIN
  FOR v_endpoint IN
    SELECT id FROM public.webhook_endpoints
    WHERE organization_id = _organization_id
      AND event_type = _event_type
      AND is_active = true
  LOOP
    INSERT INTO public.webhook_deliveries (endpoint_id, organization_id, event_type, payload)
    VALUES (v_endpoint.id, _organization_id, _event_type, _payload);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Modify submit_review_rating to fire the webhook
CREATE OR REPLACE FUNCTION public.submit_review_rating(_token text, _rating integer, _feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recipient public.campaign_recipients%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_contact public.contacts%ROWTYPE;
  v_location public.locations%ROWTYPE;
  v_route text;
  v_google_url text;
  v_payload jsonb;
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Invalid rating';
  END IF;

  SELECT * INTO v_recipient FROM public.campaign_recipients WHERE rating_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  IF v_recipient.rating_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Already submitted';
  END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_recipient.campaign_id;
  SELECT * INTO v_contact FROM public.contacts WHERE id = v_recipient.contact_id;

  IF v_recipient.location_id IS NOT NULL THEN
    SELECT * INTO v_location FROM public.locations WHERE id = v_recipient.location_id;
  END IF;

  v_google_url := COALESCE(v_location.google_review_url, v_campaign.google_review_url);

  IF _rating >= 4 THEN
    v_route := 'google';
  ELSE
    v_route := 'feedback';
    IF _feedback IS NULL OR length(trim(_feedback)) = 0 THEN
      RAISE EXCEPTION 'Feedback required for low ratings';
    END IF;

    INSERT INTO public.feedback_responses (organization_id, campaign_recipient_id, rating, feedback, contact_email, contact_name)
    VALUES (v_recipient.organization_id, v_recipient.id, _rating, trim(_feedback), v_contact.email, v_contact.name);
  END IF;

  UPDATE public.campaign_recipients
    SET rating = _rating,
        routed_to = v_route,
        rating_submitted_at = now()
    WHERE id = v_recipient.id;

  -- Webhook payload (Zapier-friendly: flat keys + nested)
  v_payload := jsonb_build_object(
    'event', 'rating.submitted',
    'occurred_at', now(),
    'organization_id', v_recipient.organization_id,
    'rating', _rating,
    'feedback', _feedback,
    'route', v_route,
    'contact_name', v_contact.name,
    'contact_email', v_contact.email,
    'campaign_id', v_campaign.id,
    'campaign_name', v_campaign.name,
    'location_id', v_recipient.location_id,
    'location_name', v_location.name,
    'recipient_id', v_recipient.id
  );

  PERFORM public.enqueue_webhook_event(v_recipient.organization_id, 'rating.submitted', v_payload);

  RETURN jsonb_build_object(
    'route', v_route,
    'google_review_url', v_google_url
  );
END;
$function$;