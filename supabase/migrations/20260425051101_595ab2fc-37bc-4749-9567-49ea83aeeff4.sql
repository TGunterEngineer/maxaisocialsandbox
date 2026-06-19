-- Repoint the hard lockdown to the real owner email
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

  IF _role = 'super_admin'::public.app_role THEN
    BEGIN
      v_jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;
    RETURN v_jwt_email = 'travisnbrittany@gmail.com';
  END IF;

  RETURN TRUE;
END;
$function$;

-- Update the signup trigger to auto-grant super_admin to the real owner email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  display_name TEXT;
  v_email TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Workspace');
  display_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', '');
  v_email := lower(COALESCE(NEW.email, ''));

  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES (NEW.id, new_org_id, display_name);

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT DO NOTHING;

  IF v_email = 'travisnbrittany@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Grant super_admin to your existing account now
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'travisnbrittany@gmail.com'
ON CONFLICT DO NOTHING;