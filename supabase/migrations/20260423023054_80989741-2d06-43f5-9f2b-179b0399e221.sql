-- A2P 10DLC registration tracking per organization
CREATE TABLE public.a2p_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Brand
  legal_business_name TEXT,
  business_type TEXT, -- 'sole_proprietor' | 'llc' | 'corporation' | 'non_profit' | 'partnership'
  ein TEXT,
  business_industry TEXT,
  business_website TEXT,
  business_address TEXT,
  business_city TEXT,
  business_state TEXT,
  business_postal_code TEXT,
  business_country TEXT DEFAULT 'US',
  business_email TEXT,
  business_phone TEXT,
  -- Authorized rep
  rep_first_name TEXT,
  rep_last_name TEXT,
  rep_email TEXT,
  rep_phone TEXT,
  rep_title TEXT,
  -- Campaign
  campaign_use_case TEXT DEFAULT 'CUSTOMER_CARE',
  campaign_description TEXT,
  message_sample_1 TEXT,
  message_sample_2 TEXT,
  opt_in_method TEXT, -- 'web_form' | 'paper_form' | 'verbal' | 'pos'
  opt_in_keywords TEXT DEFAULT 'START,SUBSCRIBE,YES',
  opt_out_keywords TEXT DEFAULT 'STOP,STOPALL,UNSUBSCRIBE,END,QUIT,CANCEL',
  help_keywords TEXT DEFAULT 'HELP,INFO',
  help_message TEXT,
  -- Status
  status TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | approved | rejected
  twilio_brand_sid TEXT,
  twilio_campaign_sid TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.a2p_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team managers can view a2p registration"
ON public.a2p_registrations FOR SELECT TO authenticated
USING (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can insert a2p registration"
ON public.a2p_registrations FOR INSERT TO authenticated
WITH CHECK (public.can_manage_team(auth.uid(), organization_id));

CREATE POLICY "Team managers can update a2p registration"
ON public.a2p_registrations FOR UPDATE TO authenticated
USING (public.can_manage_team(auth.uid(), organization_id));

CREATE TRIGGER update_a2p_registrations_updated_at
BEFORE UPDATE ON public.a2p_registrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();