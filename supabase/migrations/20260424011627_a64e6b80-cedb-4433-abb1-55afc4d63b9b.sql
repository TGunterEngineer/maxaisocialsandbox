ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_locations_last_synced_at
  ON public.locations (last_synced_at)
  WHERE google_review_url IS NOT NULL;