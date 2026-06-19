-- Tighten user_organizations INSERT: prevent any authenticated user from joining arbitrary orgs.
-- Allow self-insert ONLY when bootstrapping a brand-new org (no memberships yet).
DROP POLICY IF EXISTS "Users can insert memberships for themselves" ON public.user_organizations;

CREATE POLICY "Users can bootstrap their own org membership"
ON public.user_organizations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.user_organizations existing
    WHERE existing.organization_id = user_organizations.organization_id
  )
);

-- Atomic, server-enforced organization creation: creates org + owner membership in one call.
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _primary_color text DEFAULT '#3B82F6')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name required';
  END IF;

  INSERT INTO public.organizations (name, primary_color)
  VALUES (trim(_name), COALESCE(_primary_color, '#3B82F6'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (auth.uid(), new_org_id, 'owner');

  RETURN new_org_id;
END;
$$;