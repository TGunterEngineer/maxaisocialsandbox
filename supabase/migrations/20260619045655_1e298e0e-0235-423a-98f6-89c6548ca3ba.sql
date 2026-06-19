-- 1) campaign_recipients.rating_token: hide column from regular authenticated users.
REVOKE SELECT ON public.campaign_recipients FROM authenticated;
GRANT SELECT (
  id, organization_id, campaign_id, contact_id, location_id,
  send_status, sent_at, rating, rating_submitted_at, routed_to,
  created_at, phone
) ON public.campaign_recipients TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated;

-- 2) review_ingest_keys: switch from plaintext `key` to `key_hash` + `key_prefix`.
ALTER TABLE public.review_ingest_keys
  ADD COLUMN IF NOT EXISTS key_hash text,
  ADD COLUMN IF NOT EXISTS key_prefix text;

UPDATE public.review_ingest_keys
SET key_hash = encode(extensions.digest(key, 'sha256'), 'hex'),
    key_prefix = substring(key from 1 for 8)
WHERE key_hash IS NULL;

ALTER TABLE public.review_ingest_keys DROP CONSTRAINT IF EXISTS review_ingest_keys_key_key;
ALTER TABLE public.review_ingest_keys DROP COLUMN IF EXISTS key;

ALTER TABLE public.review_ingest_keys
  ALTER COLUMN key_hash SET NOT NULL,
  ALTER COLUMN key_prefix SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS review_ingest_keys_key_hash_idx
  ON public.review_ingest_keys (key_hash);

-- 3) RPC to mint a new key. Returns the raw value once; the row stores only the hash.
CREATE OR REPLACE FUNCTION public.create_review_ingest_key(_org_id uuid, _name text)
RETURNS TABLE(id uuid, name text, key text, key_prefix text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_raw_key text;
  v_row public.review_ingest_keys%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_manage_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorized to manage ingest keys';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Key name required';
  END IF;

  v_raw_key := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.review_ingest_keys (
    organization_id, name, created_by, key_hash, key_prefix
  )
  VALUES (
    _org_id,
    trim(_name),
    auth.uid(),
    encode(extensions.digest(v_raw_key, 'sha256'), 'hex'),
    substring(v_raw_key from 1 for 8)
  )
  RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, v_row.name, v_raw_key, v_row.key_prefix, v_row.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_review_ingest_key(uuid, text) TO authenticated;
