-- Hide rating_token from regular org members (only service role / SECURITY DEFINER funcs need it)
REVOKE SELECT (rating_token) ON public.campaign_recipients FROM authenticated, anon;

-- Allow org admins/owners to view SMS suppressions and suppressed emails for their org context
CREATE POLICY "Org admins can view sms suppressions"
ON public.sms_suppressions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Org admins can view suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));