-- Locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  google_review_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_org ON public.locations(organization_id);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view locations"
  ON public.locations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert locations"
  ON public.locations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update locations"
  ON public.locations FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete locations"
  ON public.locations FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contacts
  ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX idx_contacts_location ON public.contacts(location_id);

ALTER TABLE public.campaign_recipients
  ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX idx_campaign_recipients_location ON public.campaign_recipients(location_id);

CREATE TABLE public.campaign_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, location_id)
);

CREATE INDEX idx_campaign_locations_campaign ON public.campaign_locations(campaign_id);
CREATE INDEX idx_campaign_locations_location ON public.campaign_locations(location_id);

ALTER TABLE public.campaign_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view campaign_locations"
  ON public.campaign_locations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert campaign_locations"
  ON public.campaign_locations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete campaign_locations"
  ON public.campaign_locations FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Drop and recreate get_rating_context with new return shape (adds location_name)
DROP FUNCTION IF EXISTS public.get_rating_context(text);

CREATE FUNCTION public.get_rating_context(_token text)
 RETURNS TABLE(recipient_id uuid, campaign_id uuid, organization_id uuid, organization_name text, organization_logo_url text, organization_primary_color text, google_review_url text, contact_name text, location_name text, already_submitted boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    cr.id,
    c.id,
    c.organization_id,
    o.name,
    o.logo_url,
    o.primary_color,
    COALESCE(loc.google_review_url, c.google_review_url),
    ct.name,
    loc.name,
    cr.rating_submitted_at IS NOT NULL
  FROM public.campaign_recipients cr
  JOIN public.campaigns c ON c.id = cr.campaign_id
  JOIN public.organizations o ON o.id = c.organization_id
  JOIN public.contacts ct ON ct.id = cr.contact_id
  LEFT JOIN public.locations loc ON loc.id = cr.location_id
  WHERE cr.rating_token = _token
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.submit_review_rating(_token text, _rating integer, _feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recipient public.campaign_recipients%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_contact public.contacts%ROWTYPE;
  v_location public.locations%ROWTYPE;
  v_route text;
  v_google_url text;
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Invalid rating';
  END IF;

  SELECT * INTO v_recipient FROM public.campaign_recipients WHERE rating_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  IF v_recipient.rating_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Already submitted';
  END IF;

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_recipient.campaign_id;
  SELECT * INTO v_contact FROM public.contacts WHERE id = v_recipient.contact_id;

  IF v_recipient.location_id IS NOT NULL THEN
    SELECT * INTO v_location FROM public.locations WHERE id = v_recipient.location_id;
  END IF;

  v_google_url := COALESCE(v_location.google_review_url, v_campaign.google_review_url);

  IF _rating >= 4 THEN
    v_route := 'google';
  ELSE
    v_route := 'feedback';
    IF _feedback IS NULL OR length(trim(_feedback)) = 0 THEN
      RAISE EXCEPTION 'Feedback required for low ratings';
    END IF;

    INSERT INTO public.feedback_responses (organization_id, campaign_recipient_id, rating, feedback, contact_email, contact_name)
    VALUES (v_recipient.organization_id, v_recipient.id, _rating, trim(_feedback), v_contact.email, v_contact.name);
  END IF;

  UPDATE public.campaign_recipients
    SET rating = _rating,
        routed_to = v_route,
        rating_submitted_at = now()
    WHERE id = v_recipient.id;

  RETURN jsonb_build_object(
    'route', v_route,
    'google_review_url', v_google_url
  );
END;
$function$;