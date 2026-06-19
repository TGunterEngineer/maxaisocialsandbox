-- Fix 1: Allow all org members (including members/viewers) to read locations
DROP POLICY IF EXISTS "Org members can view accessible locations" ON public.locations;

CREATE POLICY "Org members can view locations"
ON public.locations
FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

-- Fix 2: Authorize realtime topics used for reviews, feedback, and dashboard stats
CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_target uuid;
BEGIN
  IF v_user_id IS NULL OR _topic IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _topic LIKE 'realtime:public:notifications-%' THEN
    BEGIN
      v_target := substring(_topic FROM 'notifications-([0-9a-fA-F-]{36})$')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN FALSE;
    END;
    RETURN v_target = v_user_id;
  END IF;

  IF _topic LIKE 'realtime:public:subscriptions:%' THEN
    BEGIN
      v_target := substring(_topic FROM 'subscriptions:([0-9a-fA-F-]{36})$')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN FALSE;
    END;
    RETURN EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.organization_id = v_target AND uo.user_id = v_user_id
    );
  END IF;

  -- Org-scoped feeds: reviews-feed-{org_id}, feedback-feed-{org_id}, dashboard-stats-{org_id}
  IF _topic ~ '^realtime:public:(reviews-feed|feedback-feed|dashboard-stats)-[0-9a-fA-F-]{36}$' THEN
    BEGIN
      v_target := substring(_topic FROM '-([0-9a-fA-F-]{36})$')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN FALSE;
    END;
    RETURN EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.organization_id = v_target AND uo.user_id = v_user_id
    );
  END IF;

  RETURN FALSE;
END;
$function$;