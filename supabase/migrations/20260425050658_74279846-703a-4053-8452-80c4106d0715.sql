-- Auto-grant super_admin to the locked-down owner email on signup,
-- plus backfill if the user already exists.

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

  -- Auto-grant super_admin to the hard-coded owner email
  IF v_email = 'admin@maximumaiconsulting.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: if the owner already exists, grant the role now
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'admin@maximumaiconsulting.com'
ON CONFLICT DO NOTHING;