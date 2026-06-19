-- 1. Allow rating-only reviews (no text body)
ALTER TABLE public.reviews ALTER COLUMN text DROP NOT NULL;

-- 2. Atomic founder slot claim. Uses a single INSERT that races against
-- (slot_number) uniqueness; whichever transaction wins keeps the slot.
-- Replaces the prior SELECT-then-INSERT pattern.
CREATE UNIQUE INDEX IF NOT EXISTS founder_slots_slot_number_key
  ON public.founder_slots (slot_number);

CREATE OR REPLACE FUNCTION public.claim_founder_slot(_org_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing INTEGER;
  v_candidate INTEGER;
BEGIN
  -- Already claimed for this org? Return existing slot.
  SELECT slot_number INTO v_existing
  FROM public.founder_slots
  WHERE organization_id = _org_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Try slots 1..10 in order. UNIQUE on slot_number guarantees only one
  -- transaction per slot_number wins. If a slot is taken concurrently,
  -- the INSERT raises unique_violation and we try the next slot.
  FOR v_candidate IN 1..10 LOOP
    BEGIN
      INSERT INTO public.founder_slots (slot_number, organization_id, user_id)
      VALUES (v_candidate, _org_id, _user_id);
      RETURN v_candidate;
    EXCEPTION
      WHEN unique_violation THEN
        -- Race: this slot just got claimed. Re-check whether this org now
        -- has a slot (in case ON CONFLICT on organization_id triggered),
        -- otherwise advance to the next slot number.
        SELECT slot_number INTO v_existing
        FROM public.founder_slots
        WHERE organization_id = _org_id;
        IF v_existing IS NOT NULL THEN
          RETURN v_existing;
        END IF;
        CONTINUE;
    END;
  END LOOP;

  -- All 10 slots are taken
  RETURN NULL;
END;
$function$;

-- 3. Realtime ACL: drop the dead `trial-conversion` topic. Keep only
-- per-user notifications and per-org subscriptions.
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

  RETURN FALSE;
END;
$function$;

-- 4. Index for "unanalyzed reviews" lookups (sentiment IS NULL filter)
CREATE INDEX IF NOT EXISTS reviews_org_sentiment_null_idx
  ON public.reviews (organization_id)
  WHERE sentiment IS NULL;