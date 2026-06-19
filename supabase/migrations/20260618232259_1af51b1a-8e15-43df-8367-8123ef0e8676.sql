
-- Lock down user_roles writes: only service_role can insert/update/delete.
-- (guard_super_admin_changes trigger already enforces super_admin escalation rules,
-- but RLS lacked any INSERT/UPDATE/DELETE policy enumeration — adding restrictive ones.)
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;

DROP POLICY IF EXISTS "Service role manages user_roles" ON public.user_roles;
CREATE POLICY "Service role manages user_roles"
ON public.user_roles
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Restrict sms_send_log reads to org writers (owner/admin), hiding recipient phone numbers from viewers/members.
DROP POLICY IF EXISTS "Org members can view sms log" ON public.sms_send_log;
CREATE POLICY "Org writers can view sms log"
ON public.sms_send_log
FOR SELECT
TO authenticated
USING (organization_id IS NOT NULL AND public.can_write_org(auth.uid(), organization_id));
