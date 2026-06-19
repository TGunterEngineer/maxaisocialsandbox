CREATE POLICY "Authenticated can insert client error logs"
ON public.error_logs
FOR INSERT
TO authenticated
WITH CHECK (
  source = 'client'
  AND level IN ('warning', 'error', 'info')
  AND (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id))
);