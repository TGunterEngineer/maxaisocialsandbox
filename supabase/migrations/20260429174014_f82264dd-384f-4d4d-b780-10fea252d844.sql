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
  avatar TEXT;
BEGIN
  -- Display name: try full_name (email signup), then name (Google), then email local-part
  display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    ''
  );

  -- Org name: explicit company_name, else "<Name>'s Workspace", else "My Workspace"
  org_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'company_name', ''),
    CASE WHEN display_name <> '' THEN display_name || '''s Workspace' END,
    'My Workspace'
  );

  -- Avatar from Google providers
  avatar := COALESCE(
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'picture'
  );

  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (user_id, organization_id, full_name, avatar_url)
  VALUES (NEW.id, new_org_id, display_name, avatar);

  INSERT INTO public.user_organizations (user_id, organization_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;