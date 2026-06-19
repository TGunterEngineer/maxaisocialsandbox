-- Restrict error_logs SELECT to super_admin only
DROP POLICY IF EXISTS "Admins can view error logs" ON public.error_logs;
CREATE POLICY "Super admins can view error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Restrict sms_suppressions SELECT to super_admin only
DROP POLICY IF EXISTS "Org admins can view sms suppressions" ON public.sms_suppressions;
CREATE POLICY "Super admins can view sms suppressions"
  ON public.sms_suppressions FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Restrict suppressed_emails SELECT to super_admin only
DROP POLICY IF EXISTS "Org admins can view suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Super admins can view suppressed emails"
  ON public.suppressed_emails FOR SELECT
  TO authenticated
  USING (public.is_super_admin());