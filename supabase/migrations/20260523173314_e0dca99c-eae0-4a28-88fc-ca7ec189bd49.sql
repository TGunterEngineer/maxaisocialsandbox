
-- 1. Alert phone for organizations (premium/founder batched SMS)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS alert_phone text;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_alert_phone_e164_chk
  CHECK (alert_phone IS NULL OR alert_phone ~ '^\+[1-9][0-9]{6,15}$');

-- 2. Pending admin alerts queue
CREATE TABLE IF NOT EXISTS public.pending_admin_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('low_rating', 'campaign_complete')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  dispatch_channel text,
  dispatch_error text
);

CREATE INDEX IF NOT EXISTS idx_pending_admin_alerts_unprocessed
  ON public.pending_admin_alerts (organization_id, created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.pending_admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin alerts"
  ON public.pending_admin_alerts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Team managers can view admin alerts"
  ON public.pending_admin_alerts FOR SELECT
  TO authenticated
  USING (can_manage_team(auth.uid(), organization_id));

-- 3. Update submit_review_rating to enqueue admin alert on low rating
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
  v_owner RECORD;
  v_owner_email text;
BEGIN
  IF NOT public.check_rate_limit('submit_review_rating', COALESCE(_token, 'unknown'), 5, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;

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
  IF v_google_url IS NOT NULL AND v_google_url !~* '^https?://' THEN
    v_google_url := NULL;
  END IF;

  IF _rating >= 4 THEN
    v_route := 'google';
  ELSE
    v_route := 'feedback';
    IF _feedback IS NULL OR length(trim(_feedback)) = 0 THEN
      RAISE EXCEPTION 'Feedback required for low ratings';
    END IF;

    INSERT INTO public.feedback_responses (organization_id, campaign_recipient_id, rating, feedback, contact_email, contact_name)
    VALUES (v_recipient.organization_id, v_recipient.id, _rating, trim(_feedback), v_contact.email, v_contact.name);

    PERFORM public.enqueue_webhook_event(
      v_recipient.organization_id,
      'feedback.received',
      jsonb_build_object(
        'event', 'feedback.received',
        'occurred_at', now(),
        'organization_id', v_recipient.organization_id,
        'rating', _rating,
        'feedback', trim(_feedback),
        'contact_name', v_contact.name,
        'contact_email', v_contact.email,
        'campaign_id', v_campaign.id,
        'campaign_name', v_campaign.name,
        'location_id', v_recipient.location_id,
        'location_name', v_location.name,
        'recipient_id', v_recipient.id
      )
    );

    FOR v_owner IN
      SELECT uo.user_id
      FROM public.user_organizations uo
      WHERE uo.organization_id = v_recipient.organization_id
        AND uo.role IN ('owner','admin')
    LOOP
      SELECT email INTO v_owner_email FROM auth.users WHERE id = v_owner.user_id;
      IF v_owner_email IS NOT NULL THEN
        INSERT INTO public.notifications (organization_id, user_id, kind, title, body, link, metadata)
        VALUES (
          v_recipient.organization_id,
          v_owner.user_id,
          'low_rating',
          'New low rating received',
          COALESCE(v_contact.name, 'A customer') || ' left a ' || _rating || '★ rating',
          '/feedback',
          jsonb_build_object('rating', _rating, 'recipient_id', v_recipient.id)
        );
      END IF;
    END LOOP;

    -- Enqueue admin alert for tier-aware dispatch (email for Starter/Pro, batched SMS for Premium/Founder)
    INSERT INTO public.pending_admin_alerts (organization_id, kind, payload)
    VALUES (
      v_recipient.organization_id,
      'low_rating',
      jsonb_build_object(
        'rating', _rating,
        'feedback', trim(_feedback),
        'contact_name', v_contact.name,
        'campaign_name', v_campaign.name,
        'location_name', v_location.name,
        'recipient_id', v_recipient.id
      )
    );
  END IF;

  UPDATE public.campaign_recipients
  SET rating = _rating,
      rating_submitted_at = now(),
      routed_to = v_route
  WHERE id = v_recipient.id;

  PERFORM public.enqueue_webhook_event(
    v_recipient.organization_id,
    'rating.submitted',
    jsonb_build_object(
      'event', 'rating.submitted',
      'occurred_at', now(),
      'organization_id', v_recipient.organization_id,
      'rating', _rating,
      'route', v_route,
      'campaign_id', v_campaign.id,
      'campaign_name', v_campaign.name,
      'location_id', v_recipient.location_id,
      'location_name', v_location.name,
      'recipient_id', v_recipient.id,
      'contact_name', v_contact.name,
      'contact_email', v_contact.email
    )
  );

  v_payload := jsonb_build_object(
    'route', v_route,
    'google_review_url', CASE WHEN v_route = 'google' THEN v_google_url ELSE NULL END
  );

  RETURN v_payload;
END;
$function$;

-- 4. Trigger on campaigns: enqueue alert when status transitions to 'sent'
CREATE OR REPLACE FUNCTION public.enqueue_campaign_complete_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total int;
  v_responded int;
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
    SELECT COUNT(*)::int,
           COUNT(*) FILTER (WHERE send_status = 'sent')::int
    INTO v_total, v_responded
    FROM public.campaign_recipients
    WHERE campaign_id = NEW.id;

    INSERT INTO public.pending_admin_alerts (organization_id, kind, payload)
    VALUES (
      NEW.organization_id,
      'campaign_complete',
      jsonb_build_object(
        'campaign_id', NEW.id,
        'campaign_name', NEW.name,
        'channel', NEW.channel,
        'total_recipients', v_total,
        'sent_recipients', v_responded
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enqueue_campaign_complete_alert ON public.campaigns;
CREATE TRIGGER trg_enqueue_campaign_complete_alert
AFTER UPDATE OF status ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_campaign_complete_alert();
