DROP POLICY IF EXISTS "Users can view their own founder slot" ON public.founder_slots;

CREATE POLICY "Users can view their own founder slot"
ON public.founder_slots
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin());