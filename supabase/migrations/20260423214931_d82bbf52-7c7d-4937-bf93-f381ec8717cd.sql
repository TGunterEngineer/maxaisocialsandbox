
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages notifications"
  ON public.notifications FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Update submit_review_rating to insert notifications + enqueue email alert for low ratings
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

  IF _rating >= 4 THEN
    v_route := 'google';
  ELSE
    v_route := 'feedback';
    IF _feedback IS NULL OR length(trim(_feedback)) = 0 THEN
      RAISE EXCEPTION 'Feedback required for low ratings';
    END IF;

    INSERT INTO public.feedback_responses (organization_id, campaign_recipient_id, rating, feedback, contact_email, contact_name)
    VALUES (v_recipient.organization_id, v_recipient.id, _rating, trim(_feedback), v_contact.email, v_contact.name);

    -- Insert in-app notifications for all org owners
    FOR v_owner IN
      SELECT uo.user_id
      FROM public.user_organizations uo
      WHERE uo.organization_id = v_recipient.organization_id AND uo.role = 'owner'
    LOOP
      INSERT INTO public.notifications (organization_id, user_id, kind, title, body, link, metadata)
      VALUES (
        v_recipient.organization_id,
        v_owner.user_id,
        'low_rating',
        format('New %s★ rating from %s', _rating, COALESCE(v_contact.name, 'a customer')),
        left(trim(_feedback), 240),
        '/feedback',
        jsonb_build_object(
          'rating', _rating,
          'contact_name', v_contact.name,
          'contact_email', v_contact.email,
          'campaign_name', v_campaign.name,
          'location_name', v_location.name,
          'recipient_id', v_recipient.id
        )
      );

      -- Enqueue email alert per owner
      SELECT email INTO v_owner_email FROM auth.users WHERE id = v_owner.user_id;
      IF v_owner_email IS NOT NULL THEN
        PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
          'templateName', 'low-rating-alert',
          'recipientEmail', v_owner_email,
          'idempotencyKey', 'low-rating-' || v_recipient.id::text || '-' || v_owner.user_id::text,
          'templateData', jsonb_build_object(
            'rating', _rating,
            'contactName', v_contact.name,
            'feedback', trim(_feedback),
            'campaignName', v_campaign.name,
            'locationName', v_location.name
          )
        ));
      END IF;
    END LOOP;
  END IF;

  UPDATE public.campaign_recipients
    SET rating = _rating,
        routed_to = v_route,
        rating_submitted_at = now()
    WHERE id = v_recipient.id;

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
