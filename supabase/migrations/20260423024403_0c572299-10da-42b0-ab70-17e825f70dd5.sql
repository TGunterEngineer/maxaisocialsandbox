-- Explicit INSERT policy: deny direct inserts. Only SECURITY DEFINER functions
-- (create_organization, accept_invitation) can write to user_organizations.
DROP POLICY IF EXISTS "No direct membership inserts" ON public.user_organizations;
CREATE POLICY "No direct membership inserts"
ON public.user_organizations FOR INSERT TO authenticated
WITH CHECK (false);

-- Also ensure team_invitations can be looked up by token without auth (for invite acceptance).
-- Already handled by get_invitation_by_token() SECURITY DEFINER — confirm permissions.
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;