-- Re-declare with explicit search_path to silence linter warnings
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
  organization_id UUID,
  organization_name TEXT,
  organization_logo_url TEXT,
  email TEXT,
  role TEXT,
  expired BOOLEAN,
  accepted BOOLEAN
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.organization_id,
    o.name,
    o.logo_url,
    i.email,
    i.role,
    i.expires_at < now(),
    i.accepted_at IS NOT NULL
  FROM public.team_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = _token
  LIMIT 1;
$$;

-- Fix any other functions missing search_path (legacy queue helpers)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;