-- 1) Founder slots: restrict SELECT to owner of slot or admin
DROP POLICY IF EXISTS "Anyone authenticated can view founder slots count" ON public.founder_slots;

CREATE POLICY "Users can view their own founder slot"
ON public.founder_slots
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2) Remove org-bootstrap race policy. create_organization() handles this atomically.
DROP POLICY IF EXISTS "Users can bootstrap their own org membership" ON public.user_organizations;

-- 3) Rate-limit table for public RPC abuse protection
CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,            -- e.g. 'submit_review_rating', 'unsubscribe'
  identifier TEXT NOT NULL,        -- token / email / phone hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_rate_limits_lookup
  ON public.public_rate_limits (bucket, identifier, created_at DESC);

ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write directly
CREATE POLICY "Service role manages rate limits"
ON public.public_rate_limits FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4) Helper to check + record an attempt (atomic). Returns TRUE when allowed.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket TEXT,
  _identifier TEXT,
  _max_attempts INT,
  _window_minutes INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)::int INTO v_count
  FROM public.public_rate_limits
  WHERE bucket = _bucket
    AND identifier = _identifier
    AND created_at > now() - make_interval(mins => _window_minutes);

  IF v_count >= _max_attempts THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.public_rate_limits (bucket, identifier) VALUES (_bucket, _identifier);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) TO anon, authenticated;

-- 5) Wrap submit_review_rating with rate limiting (5 attempts per token per hour)
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
  -- Rate limit: 5 attempts per token per hour
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

-- 6) Cleanup old rate-limit rows (anything older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.public_rate_limits WHERE created_at < now() - INTERVAL '24 hours';
$$;