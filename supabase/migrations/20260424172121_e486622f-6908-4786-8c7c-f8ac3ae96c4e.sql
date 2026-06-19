ALTER TABLE public.team_invitations
DROP COLUMN IF EXISTS token;

DROP POLICY IF EXISTS "Org members can insert recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Org members can update recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Org members can delete recipients" ON public.campaign_recipients;

CREATE POLICY "Writers can insert recipients"
ON public.campaign_recipients
FOR INSERT
TO authenticated
WITH CHECK (public.can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can update recipients"
ON public.campaign_recipients
FOR UPDATE
TO authenticated
USING (public.can_write_org(auth.uid(), organization_id))
WITH CHECK (public.can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can delete recipients"
ON public.campaign_recipients
FOR DELETE
TO authenticated
USING (public.can_write_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org members can insert campaign_locations" ON public.campaign_locations;
DROP POLICY IF EXISTS "Org members can delete campaign_locations" ON public.campaign_locations;

CREATE POLICY "Writers can insert campaign_locations"
ON public.campaign_locations
FOR INSERT
TO authenticated
WITH CHECK (public.can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can delete campaign_locations"
ON public.campaign_locations
FOR DELETE
TO authenticated
USING (public.can_write_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Team managers can view webhooks" ON public.webhook_endpoints;

CREATE OR REPLACE FUNCTION public.list_webhook_endpoints(_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  event_type text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    we.id,
    we.name,
    we.url,
    we.event_type,
    we.is_active,
    we.created_at,
    we.updated_at
  FROM public.webhook_endpoints we
  WHERE we.organization_id = _org_id
    AND public.can_manage_team(auth.uid(), _org_id)
  ORDER BY we.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.create_webhook_endpoint(
  _org_id uuid,
  _name text,
  _url text,
  _event_type text DEFAULT 'rating.submitted'
)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  event_type text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  signing_secret text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.webhook_endpoints%ROWTYPE;
  v_secret text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_manage_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorized to manage webhooks';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Webhook name required';
  END IF;

  IF _url IS NULL OR length(trim(_url)) = 0 THEN
    RAISE EXCEPTION 'Webhook URL required';
  END IF;

  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.webhook_endpoints (organization_id, name, url, event_type, created_by, secret)
  VALUES (_org_id, trim(_name), trim(_url), COALESCE(NULLIF(trim(_event_type), ''), 'rating.submitted'), auth.uid(), v_secret)
  RETURNING * INTO v_row;

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
$$;

CREATE OR REPLACE FUNCTION public.rotate_webhook_secret(_endpoint_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_secret text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.webhook_endpoints
  WHERE id = _endpoint_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Webhook not found';
  END IF;

  IF NOT public.can_manage_team(auth.uid(), v_org_id) THEN
    RAISE EXCEPTION 'Not authorized to manage webhooks';
  END IF;

  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  UPDATE public.webhook_endpoints
  SET secret = v_secret,
      updated_at = now()
  WHERE id = _endpoint_id;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.list_webhook_endpoints(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_webhook_endpoint(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_webhook_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_webhook_endpoints(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_webhook_endpoint(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_webhook_secret(uuid) TO authenticated;