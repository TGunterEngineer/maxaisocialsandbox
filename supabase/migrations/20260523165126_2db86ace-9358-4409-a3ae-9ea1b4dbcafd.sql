
CREATE OR REPLACE FUNCTION public.retry_webhook_delivery(_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_max int;
  v_attempts int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT organization_id, max_attempts, attempts
    INTO v_org, v_max, v_attempts
  FROM public.webhook_deliveries
  WHERE id = _delivery_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  IF NOT public.can_manage_team(auth.uid(), v_org) THEN
    RAISE EXCEPTION 'Not authorized to retry webhook deliveries';
  END IF;

  UPDATE public.webhook_deliveries
  SET status = 'pending',
      next_attempt_at = now(),
      -- Give the retry a fresh attempt budget if it had already exhausted it,
      -- otherwise just re-queue at the current attempt count.
      max_attempts = GREATEST(v_max, v_attempts + 1),
      last_error = NULL,
      updated_at = now()
  WHERE id = _delivery_id;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_webhook_delivery(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.retry_webhook_delivery(uuid) TO authenticated;
