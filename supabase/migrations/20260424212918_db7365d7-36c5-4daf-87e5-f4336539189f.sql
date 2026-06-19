-- 2. Harden has_role: super_admin requires JWT email match
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_row boolean;
  v_jwt_email text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) INTO v_has_row;

  IF NOT v_has_row THEN
    RETURN FALSE;
  END IF;

  -- Hard lockdown: super_admin must also have a matching verified JWT email
  IF _role = 'super_admin'::public.app_role THEN
    BEGIN
      v_jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;
    RETURN v_jwt_email = 'admin@maximumaiconsulting.com';
  END IF;

  RETURN TRUE;
END;
$function$;

-- 3. Convenience helper
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role);
$function$;
