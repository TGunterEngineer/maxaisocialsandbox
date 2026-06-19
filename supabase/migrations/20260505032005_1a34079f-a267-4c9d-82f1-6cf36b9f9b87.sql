-- Revoke broad execute from PUBLIC and anon on all SECURITY DEFINER functions,
-- then grant back narrowly to authenticated, and to anon only where genuinely public.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role;', r.proname, r.args);
  END LOOP;
END $$;

-- Public-facing functions that anonymous visitors must be able to call:
GRANT EXECUTE ON FUNCTION public.get_rating_context(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_review_rating(text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_founder_slots_remaining() TO anon;