-- Add review gating toggle to organizations (default ON to preserve current behavior)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS review_gating_enabled boolean NOT NULL DEFAULT true;

-- Update submit_review_rating to honor the org-level gating flag.
-- When gating is OFF: every rating (including 1-3★) is routed straight to the public Google URL,
-- no private feedback form is shown, no feedback_responses row is created, no low_rating alert is fired.
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
  v_gating_enabled boolean;
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

  SELECT COALESCE(review_gating_enabled, true) INTO v_gating_enabled
    FROM public.organizations WHERE id = v_recipient.organization_id;

  v_google_url := COALESCE(v_location.google_review_url, v_campaign.google_review_url);
  IF v_google_url IS NOT NULL AND v_google_url !~* '^https?://' THEN
    v_google_url := NULL;
  END IF;

  IF _rating >= 4 OR v_gating_enabled = false THEN
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