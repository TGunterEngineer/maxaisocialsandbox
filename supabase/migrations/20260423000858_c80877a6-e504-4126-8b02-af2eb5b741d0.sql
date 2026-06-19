
-- Re-create with explicit SET search_path (already set, but linter wants it inline in CREATE)
CREATE OR REPLACE FUNCTION public.get_rating_context(_token text)
RETURNS TABLE (
  recipient_id uuid,
  campaign_id uuid,
  organization_id uuid,
  organization_name text,
  organization_logo_url text,
  organization_primary_color text,
  google_review_url text,
  contact_name text,
  already_submitted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    cr.id,
    c.id,
    c.organization_id,
    o.name,
    o.logo_url,
    o.primary_color,
    c.google_review_url,
    ct.name,
    cr.rating_submitted_at IS NOT NULL
  FROM public.campaign_recipients cr
  JOIN public.campaigns c ON c.id = cr.campaign_id
  JOIN public.organizations o ON o.id = c.organization_id
  JOIN public.contacts ct ON ct.id = cr.contact_id
  WHERE cr.rating_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_review_rating(
  _token text,
  _rating int,
  _feedback text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_recipient public.campaign_recipients%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_contact public.contacts%ROWTYPE;
  v_route text;
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

  RETURN jsonb_build_object(
    'route', v_route,
    'google_review_url', v_campaign.google_review_url
  );
END;
$$;
