DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Org members can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "Service role can insert feedback responses"
ON public.feedback_responses
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Team managers can update invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (public.can_manage_team(auth.uid(), organization_id))
WITH CHECK (public.can_manage_team(auth.uid(), organization_id));