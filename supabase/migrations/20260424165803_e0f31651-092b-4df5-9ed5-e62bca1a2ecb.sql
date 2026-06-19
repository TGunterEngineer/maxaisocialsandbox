CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.can_write_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id
      AND role IN ('owner', 'admin')
  );
$$;

DROP POLICY IF EXISTS "Owners can update other members memberships" ON public.user_organizations;
CREATE POLICY "Owners can update other member roles"
ON public.user_organizations
FOR UPDATE
TO authenticated
USING (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.organization_id = user_organizations.organization_id
      AND uo.user_id = auth.uid()
      AND uo.role = 'owner'
  )
)
WITH CHECK (
  user_id <> auth.uid()
  AND role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])
  AND EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.organization_id = user_organizations.organization_id
      AND uo.user_id = auth.uid()
      AND uo.role = 'owner'
  )
);

ALTER TABLE public.team_invitations
ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.team_invitations
SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL;

ALTER TABLE public.team_invitations
ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_token_hash
ON public.team_invitations(token_hash);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE(
  invitation_id uuid,
  organization_id uuid,
  organization_name text,
  organization_logo_url text,
  email text,
  role text,
  expired boolean,
  accepted boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
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
  WHERE i.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  SELECT * INTO v_invite
  FROM public.team_invitations
  WHERE token_hash = encode(extensions.digest(_token, 'sha256'), 'hex');

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
SET search_path = public, extensions
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

  UPDATE public.team_invitations
  SET token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
  WHERE id = _invitation_id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_team_invitation_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_team_invitation_token(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target uuid;
BEGIN
  IF v_user_id IS NULL OR _topic IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _topic LIKE 'realtime:public:notifications-%' THEN
    BEGIN
      v_target := substring(_topic FROM 'notifications-([0-9a-fA-F-]{36})$')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN FALSE;
    END;

    RETURN v_target = v_user_id;
  END IF;

  IF _topic LIKE 'realtime:public:subscriptions:%' THEN
    BEGIN
      v_target := substring(_topic FROM 'subscriptions:([0-9a-fA-F-]{36})$')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN FALSE;
    END;

    RETURN EXISTS (
      SELECT 1
      FROM public.user_organizations uo
      WHERE uo.organization_id = v_target
        AND uo.user_id = v_user_id
    );
  END IF;

  IF _topic LIKE 'realtime:public:trial-conversion:%' THEN
    BEGIN
      v_target := substring(_topic FROM 'trial-conversion:([0-9a-fA-F-]{36})(:.*)?$')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN FALSE;
    END;

    RETURN EXISTS (
      SELECT 1
      FROM public.user_organizations uo
      WHERE uo.organization_id = v_target
        AND uo.user_id = v_user_id
    );
  END IF;

  RETURN FALSE;
END;
$$;

CREATE POLICY "Authenticated users can receive approved realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_access_realtime_topic(topic));