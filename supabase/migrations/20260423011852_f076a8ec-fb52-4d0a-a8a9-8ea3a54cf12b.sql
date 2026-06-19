-- Extend role system: add admin/viewer to existing owner/member set
-- (user_organizations.role is text, so we just adopt the new vocabulary in code)

-- 1. Per-user location access (only matters for member/viewer)
CREATE TABLE public.user_location_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, location_id)
);

CREATE INDEX idx_uloc_user_org ON public.user_location_access(user_id, organization_id);

ALTER TABLE public.user_location_access ENABLE ROW LEVEL SECURITY;

-- 2. Helper: get user's role in an org
CREATE OR REPLACE FUNCTION public.get_org_role(_user_id UUID, _org_id UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_organizations
  WHERE user_id = _user_id AND organization_id = _org_id
  LIMIT 1;
$$;

-- 3. Helper: can user manage team in org? (owner or admin)
CREATE OR REPLACE FUNCTION public.can_manage_team(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id
      AND role IN ('owner', 'admin')
  );
$$;

-- 4. Helper: can user access a specific location?
-- owner/admin = all locations in org; member/viewer = only assigned
CREATE OR REPLACE FUNCTION public.can_access_location(_user_id UUID, _location_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.locations l
    JOIN public.user_organizations uo
      ON uo.organization_id = l.organization_id AND uo.user_id = _user_id
    WHERE l.id = _location_id
      AND (
        uo.role IN ('owner', 'admin')
        OR EXISTS (
          SELECT 1 FROM public.user_location_access ula
          WHERE ula.user_id = _user_id AND ula.location_id = _location_id
        )
      )
  );
$$;

-- 5. Helper: is user write-capable in org? (owner/admin/member, NOT viewer)
CREATE OR REPLACE FUNCTION public.can_write_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id
      AND role IN ('owner', 'admin', 'member')
  );
$$;

-- RLS for user_location_access
CREATE POLICY "Org members can view location access"
ON public.user_location_access FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Team managers can insert location access"
ON public.user_location_access FOR INSERT TO authenticated
WITH CHECK (can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can delete location access"
ON public.user_location_access FOR DELETE TO authenticated
USING (can_manage_team(auth.uid(), organization_id));

-- 6. Invitations table
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  location_ids UUID[] NOT NULL DEFAULT '{}',
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  invited_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_org ON public.team_invitations(organization_id);
CREATE INDEX idx_invites_email ON public.team_invitations(lower(email));

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team managers can view invitations"
ON public.team_invitations FOR SELECT TO authenticated
USING (can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can create invitations"
ON public.team_invitations FOR INSERT TO authenticated
WITH CHECK (can_manage_team(auth.uid(), organization_id) AND invited_by = auth.uid());

CREATE POLICY "Team managers can delete invitations"
ON public.team_invitations FOR DELETE TO authenticated
USING (can_manage_team(auth.uid(), organization_id));

-- 7. Public RPC: read invitation by token (no auth required - used on accept page)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
  organization_id UUID,
  organization_name TEXT,
  organization_logo_url TEXT,
  email TEXT,
  role TEXT,
  expired BOOLEAN,
  accepted BOOLEAN
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
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
  WHERE i.token = _token
  LIMIT 1;
$$;

-- 8. Accept invitation (called by authenticated user)
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.team_invitations%ROWTYPE;
  v_user_email TEXT;
  v_loc UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_invite FROM public.team_invitations WHERE token = _token;
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

  -- Add membership (idempotent)
  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (auth.uid(), v_invite.organization_id, v_invite.role)
  ON CONFLICT DO NOTHING;

  -- Grant location access for member/viewer
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

-- 9. Update locations RLS so members/viewers only see assigned locations
DROP POLICY IF EXISTS "Org members can view locations" ON public.locations;
CREATE POLICY "Org members can view accessible locations"
ON public.locations FOR SELECT TO authenticated
USING (
  is_org_member(auth.uid(), organization_id)
  AND (
    get_org_role(auth.uid(), organization_id) IN ('owner', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_location_access ula
      WHERE ula.user_id = auth.uid() AND ula.location_id = locations.id
    )
  )
);

-- Restrict location writes: owner/admin only
DROP POLICY IF EXISTS "Org members can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Org members can update locations" ON public.locations;
DROP POLICY IF EXISTS "Org members can delete locations" ON public.locations;

CREATE POLICY "Team managers can insert locations"
ON public.locations FOR INSERT TO authenticated
WITH CHECK (can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can update locations"
ON public.locations FOR UPDATE TO authenticated
USING (can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can delete locations"
ON public.locations FOR DELETE TO authenticated
USING (can_manage_team(auth.uid(), organization_id));

-- 10. Block viewers from writing campaigns/contacts/recipients
DROP POLICY IF EXISTS "Org members can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Org members can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Org members can delete campaigns" ON public.campaigns;

CREATE POLICY "Writers can insert campaigns"
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (can_write_org(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Writers can update campaigns"
ON public.campaigns FOR UPDATE TO authenticated
USING (can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can delete campaigns"
ON public.campaigns FOR DELETE TO authenticated
USING (can_write_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org members can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Org members can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Org members can delete contacts" ON public.contacts;

CREATE POLICY "Writers can insert contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can update contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can delete contacts"
ON public.contacts FOR DELETE TO authenticated
USING (can_write_org(auth.uid(), organization_id));