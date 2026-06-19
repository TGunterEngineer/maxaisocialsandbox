
-- 1. Simplify has_role: rely strictly on user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Simplify handle_new_user: no more email-based super_admin grant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
  display_name TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'My Workspace');
  display_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', '');

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

  RETURN NEW;
END;
$$;

-- 3. Guard trigger: only super_admins can grant/revoke super_admin
CREATE OR REPLACE FUNCTION public.guard_super_admin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_service boolean := (auth.role() = 'service_role');
BEGIN
  -- Allow service_role and direct DB access (auth.uid() IS NULL) for bootstrapping
  IF v_is_service OR v_caller IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- INSERT of super_admin: caller must already be super_admin
  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin'::app_role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'super_admin'::app_role
    ) THEN
      RAISE EXCEPTION 'Only existing super_admins can grant the super_admin role';
    END IF;
  END IF;

  -- DELETE of super_admin: caller must be super_admin AND cannot delete their own row
  IF TG_OP = 'DELETE' AND OLD.role = 'super_admin'::app_role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'super_admin'::app_role
    ) THEN
      RAISE EXCEPTION 'Only super_admins can revoke the super_admin role';
    END IF;
    IF OLD.user_id = v_caller THEN
      RAISE EXCEPTION 'Super_admins cannot revoke their own super_admin role';
    END IF;
  END IF;

  -- UPDATE that touches super_admin (in or out)
  IF TG_OP = 'UPDATE' AND (NEW.role = 'super_admin'::app_role OR OLD.role = 'super_admin'::app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'super_admin'::app_role
    ) THEN
      RAISE EXCEPTION 'Only super_admins can modify super_admin assignments';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_super_admin_changes_trg ON public.user_roles;
CREATE TRIGGER guard_super_admin_changes_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_super_admin_changes();
