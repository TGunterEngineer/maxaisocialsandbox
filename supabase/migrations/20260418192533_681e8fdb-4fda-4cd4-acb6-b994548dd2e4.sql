-- =========================================================
-- Multi-org + auth + super admin foundation (consolidated)
-- =========================================================

-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- 2. Updated-at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. Tables
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  primary_color TEXT DEFAULT '#3B82F6',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);

-- 4. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id
  );
$$;

-- 6. RLS policies

-- organizations
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Owners can update their organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.organization_id = organizations.id
        AND uo.user_id = auth.uid()
        AND uo.role = 'owner'
    )
  );

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

-- profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- user_organizations
CREATE POLICY "Users can view their own memberships"
  ON public.user_organizations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert memberships for themselves"
  ON public.user_organizations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can update other members memberships"
  ON public.user_organizations FOR UPDATE TO authenticated
  USING (
    user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.organization_id = user_organizations.organization_id
        AND uo.user_id = auth.uid()
        AND uo.role = 'owner'
    )
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND role IN ('owner', 'member')
    AND EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.organization_id = user_organizations.organization_id
        AND uo.user_id = auth.uid()
        AND uo.role = 'owner'
    )
  );

CREATE POLICY "Owners can remove other members"
  ON public.user_organizations FOR DELETE TO authenticated
  USING (
    user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.organization_id = user_organizations.organization_id
        AND uo.user_id = auth.uid()
        AND uo.role = 'owner'
    )
  );

-- user_roles (read-only to the user; service role manages writes)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 7. Updated-at triggers
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Auto-provision on signup: org + profile + owner membership + default platform role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  VALUES (NEW.id, 'member');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Admin-only: hard delete an organization and its memberships/profiles
CREATE OR REPLACE FUNCTION public.delete_organization(_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  DELETE FROM public.user_organizations WHERE organization_id = _org_id;
  DELETE FROM public.profiles WHERE organization_id = _org_id;
  DELETE FROM public.organizations WHERE id = _org_id;
END;
$$;