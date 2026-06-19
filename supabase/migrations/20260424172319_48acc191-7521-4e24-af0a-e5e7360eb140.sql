CREATE TABLE IF NOT EXISTS public.team_invitation_tokens (
  invitation_id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_invitation_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages invitation tokens" ON public.team_invitation_tokens;
CREATE POLICY "Service role manages invitation tokens"
ON public.team_invitation_tokens
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.team_invitation_tokens (invitation_id, token_hash)
SELECT id, token_hash
FROM public.team_invitations
ON CONFLICT (invitation_id) DO UPDATE
SET token_hash = EXCLUDED.token_hash;

ALTER TABLE public.team_invitations
DROP COLUMN IF EXISTS token_hash;

CREATE TABLE IF NOT EXISTS public.webhook_endpoint_secrets (
  endpoint_id uuid PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_endpoint_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages webhook endpoint secrets" ON public.webhook_endpoint_secrets;
CREATE POLICY "Service role manages webhook endpoint secrets"
ON public.webhook_endpoint_secrets
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.webhook_endpoint_secrets (endpoint_id, secret)
SELECT id, secret
FROM public.webhook_endpoints
ON CONFLICT (endpoint_id) DO UPDATE
SET secret = EXCLUDED.secret,
    updated_at = now();

ALTER TABLE public.webhook_endpoints
DROP COLUMN IF EXISTS secret;

CREATE POLICY "Team managers can view webhooks"
ON public.webhook_endpoints
FOR SELECT
TO authenticated
USING (public.can_manage_team(auth.uid(), organization_id));

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE(invitation_id uuid, organization_id uuid, organization_name text, organization_logo_url text, email text, role text, expired boolean, accepted boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    i.id,
    i.organization_id,
    o.name,
    o.logo_url,
    i.email,
    i.role,
    i.expires_at < now(),
    i.accepted_at IS NOT NULL
  FROM public.team_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  JOIN public.team_invitation_tokens tit ON tit.invitation_id = i.id
  WHERE tit.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_invite public.team_invitations%ROWTYPE;
  v_user_email text;
  v_loc uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT i.* INTO v_invite
  FROM public.team_invitations i
  JOIN public.team_invitation_tokens tit ON tit.invitation_id = i.id
  WHERE tit.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already accepted';
  END IF;
  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;
  IF lower(v_invite.email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (auth.uid(), v_invite.organization_id, v_invite.role)
  ON CONFLICT DO NOTHING;

  IF v_invite.role IN ('member', 'viewer') THEN
    FOREACH v_loc IN ARRAY v_invite.location_ids LOOP
      INSERT INTO public.user_location_access (user_id, organization_id, location_id)
      VALUES (auth.uid(), v_invite.organization_id, v_loc)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.team_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_invite.id;

  DELETE FROM public.team_invitation_tokens
  WHERE invitation_id = v_invite.id;

  RETURN jsonb_build_object(
    'organization_id', v_invite.organization_id,
    'role', v_invite.role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_team_invitation_token(_invitation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token text;
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.team_invitations
  WHERE id = _invitation_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF NOT public.can_manage_team(auth.uid(), v_org_id) THEN
    RAISE EXCEPTION 'Not authorized to issue invitation links';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.team_invitation_tokens (invitation_id, token_hash)
  VALUES (_invitation_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  ON CONFLICT (invitation_id) DO UPDATE
  SET token_hash = EXCLUDED.token_hash,
      created_at = now();

  RETURN v_token;
END;
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

  INSERT INTO public.webhook_endpoints (organization_id, name, url, event_type, created_by)
  VALUES (_org_id, trim(_name), trim(_url), COALESCE(NULLIF(trim(_event_type), ''), 'rating.submitted'), auth.uid())
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

  INSERT INTO public.webhook_endpoint_secrets (endpoint_id, secret)
  VALUES (_endpoint_id, v_secret)
  ON CONFLICT (endpoint_id) DO UPDATE
  SET secret = EXCLUDED.secret,
      updated_at = now();

  UPDATE public.webhook_endpoints
  SET updated_at = now()
  WHERE id = _endpoint_id;

  RETURN v_secret;
END;
$$;