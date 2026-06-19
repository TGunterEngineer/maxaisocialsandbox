-- Reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('google','facebook','instagram','yelp','trustpilot','manual','webhook','outscraper','other')),
  external_id TEXT,
  author_name TEXT NOT NULL,
  author_avatar_url TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  review_url TEXT,
  review_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reviews_org_source_external_unique
  ON public.reviews (organization_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX reviews_org_date_idx ON public.reviews (organization_id, review_date DESC);
CREATE INDEX reviews_org_source_idx ON public.reviews (organization_id, source);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Writers can insert reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (public.can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can update reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (public.can_write_org(auth.uid(), organization_id));

CREATE POLICY "Writers can delete reviews"
  ON public.reviews FOR DELETE TO authenticated
  USING (public.can_write_org(auth.uid(), organization_id));

CREATE POLICY "Service role can insert reviews"
  ON public.reviews FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ingest keys for webhook/CSV-via-API
CREATE TABLE public.review_ingest_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_ingest_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team managers can view ingest keys"
  ON public.review_ingest_keys FOR SELECT TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can insert ingest keys"
  ON public.review_ingest_keys FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Team managers can update ingest keys"
  ON public.review_ingest_keys FOR UPDATE TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can delete ingest keys"
  ON public.review_ingest_keys FOR DELETE TO authenticated
  USING (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Service role can read ingest keys"
  ON public.review_ingest_keys FOR SELECT TO public
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update ingest keys"
  ON public.review_ingest_keys FOR UPDATE TO public
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');