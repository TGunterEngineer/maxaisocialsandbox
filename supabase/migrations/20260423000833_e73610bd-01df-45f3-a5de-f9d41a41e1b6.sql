
-- Contacts table
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE INDEX idx_contacts_org ON public.contacts(organization_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view contacts" ON public.contacts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert contacts" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update contacts" ON public.contacts FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete contacts" ON public.contacts FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT 'How was your experience?',
  message_body text NOT NULL,
  google_review_url text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sending','sent','cancelled','failed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_org ON public.campaigns(organization_id);
CREATE INDEX idx_campaigns_status_schedule ON public.campaigns(status, scheduled_at);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND created_by = auth.uid());
CREATE POLICY "Org members can update campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign recipients
CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rating_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  send_status text NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending','sent','failed')),
  sent_at timestamptz,
  rating_submitted_at timestamptz,
  rating int CHECK (rating BETWEEN 1 AND 5),
  routed_to text CHECK (routed_to IN ('google','feedback')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX idx_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_recipients_token ON public.campaign_recipients(rating_token);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view recipients" ON public.campaign_recipients FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can insert recipients" ON public.campaign_recipients FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can update recipients" ON public.campaign_recipients FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Org members can delete recipients" ON public.campaign_recipients FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Feedback responses (private, from 1-3 star routing)
CREATE TABLE public.feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_recipient_id uuid REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback text NOT NULL,
  contact_email text,
  contact_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_org ON public.feedback_responses(organization_id);

ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view feedback" ON public.feedback_responses FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

-- Public read for the rating page (lookup by token only — no PII leaks because we only return what frontend needs)
-- We'll use a SECURITY DEFINER function instead of a public RLS policy to avoid exposing the table.

CREATE OR REPLACE FUNCTION public.get_rating_context(_token text)
RETURNS TABLE (
  recipient_id uuid,
  campaign_id uuid,
  organization_id uuid,
  organization_name text,
  organization_logo_url text,
  organization_primary_color text,
  google_review_url text,
  contact_name text,
  already_submitted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cr.id,
    c.id,
    c.organization_id,
    o.name,
    o.logo_url,
    o.primary_color,
    c.google_review_url,
    ct.name,
    cr.rating_submitted_at IS NOT NULL
  FROM public.campaign_recipients cr
  JOIN public.campaigns c ON c.id = cr.campaign_id
  JOIN public.organizations o ON o.id = c.organization_id
  JOIN public.contacts ct ON ct.id = cr.contact_id
  WHERE cr.rating_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_rating_context(text) TO anon, authenticated;

-- SECURITY DEFINER function to record rating + feedback (called by anon from rating page)
CREATE OR REPLACE FUNCTION public.submit_review_rating(
  _token text,
  _rating int,
  _feedback text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient public.campaign_recipients%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_contact public.contacts%ROWTYPE;
  v_route text;
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
    'google_review_url', v_campaign.google_review_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review_rating(text, int, text) TO anon, authenticated;
