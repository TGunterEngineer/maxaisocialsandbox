
-- 1. Allow Premium tier to create webhooks; validate event_type
CREATE OR REPLACE FUNCTION public.create_webhook_endpoint(_org_id uuid, _name text, _url text, _event_type text DEFAULT 'rating.submitted'::text)
 RETURNS TABLE(id uuid, name text, url text, event_type text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, signing_secret text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.webhook_endpoints%ROWTYPE;
  v_secret text;
  v_tier text;
  v_event text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_manage_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorized to manage webhooks';
  END IF;

  v_tier := public.get_org_plan_tier(_org_id);
  IF NOT public.is_super_admin() AND v_tier IS DISTINCT FROM 'founder' AND v_tier IS DISTINCT FROM 'premium' THEN
    RAISE EXCEPTION 'plan_limit:tier_required:webhooks'
      USING HINT = 'Webhooks require the Premium or Founder tier.';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Webhook name required';
  END IF;

  IF _url IS NULL OR length(trim(_url)) = 0 THEN
    RAISE EXCEPTION 'Webhook URL required';
  END IF;

  v_event := COALESCE(NULLIF(trim(_event_type), ''), 'rating.submitted');
  IF v_event NOT IN ('rating.submitted', 'review.created', 'feedback.received') THEN
    RAISE EXCEPTION 'Invalid event_type: %', v_event;
  END IF;

  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.webhook_endpoints (organization_id, name, url, event_type, created_by)
  VALUES (_org_id, trim(_name), trim(_url), v_event, auth.uid())
  RETURNING * INTO v_row;

  INSERT INTO public.webhook_endpoint_secrets (endpoint_id, secret)
  VALUES (v_row.id, v_secret)
  ON CONFLICT (endpoint_id) DO UPDATE
  SET secret = EXCLUDED.secret,
      updated_at = now();

  RETURN QUERY SELECT
    v_row.id,
    v_row.name,
    v_row.url,
    v_row.event_type,
    v_row.is_active,
    v_row.created_at,
    v_row.updated_at,
    v_secret;
END;
$function$;

-- 2. Trigger to emit review.created on new reviews
CREATE OR REPLACE FUNCTION public.emit_review_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.enqueue_webhook_event(
    NEW.organization_id,
    'review.created',
    jsonb_build_object(
      'event', 'review.created',
      'occurred_at', now(),
      'organization_id', NEW.organization_id,
      'review_id', NEW.id,
      'source', NEW.source,
      'external_id', NEW.external_id,
      'author_name', NEW.author_name,
      'rating', NEW.rating,
      'text', NEW.text,
      'review_url', NEW.review_url,
      'review_date', NEW.review_date,
      'location_id', NEW.location_id,
      'sentiment', NEW.sentiment
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_emit_review_created ON public.reviews;
CREATE TRIGGER trg_emit_review_created
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.emit_review_created();

-- 3. Update submit_review_rating to also emit feedback.received
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

    -- Emit feedback.received webhook event
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
