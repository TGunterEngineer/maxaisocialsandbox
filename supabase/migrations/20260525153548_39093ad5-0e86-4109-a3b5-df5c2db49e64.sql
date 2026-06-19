CREATE OR REPLACE FUNCTION public.list_founder_slots_admin()
RETURNS TABLE(
  slot_number integer,
  organization_id uuid,
  organization_name text,
  user_id uuid,
  user_email text,
  claimed_at timestamptz,
  subscription_status text,
  cancel_at_period_end boolean,
  current_period_end timestamptz,
  environment text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    fs.slot_number,
    fs.organization_id,
    o.name,
    fs.user_id,
    u.email::text,
    fs.claimed_at,
    s.status,
    s.cancel_at_period_end,
    s.current_period_end,
    s.environment
  FROM public.founder_slots fs
  LEFT JOIN public.organizations o ON o.id = fs.organization_id
  LEFT JOIN auth.users u ON u.id = fs.user_id
  LEFT JOIN LATERAL (
    SELECT status, cancel_at_period_end, current_period_end, environment
    FROM public.subscriptions
    WHERE organization_id = fs.organization_id
      AND plan_tier = 'founder'
    ORDER BY updated_at DESC
    LIMIT 1
  ) s ON true
  ORDER BY fs.slot_number;
END;
$$;