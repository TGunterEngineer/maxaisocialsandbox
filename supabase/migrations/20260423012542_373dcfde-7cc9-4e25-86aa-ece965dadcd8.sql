-- Branding fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS email_from_name TEXT,
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS email_footer_text TEXT;

-- Logo storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, team-managers write within their org folder
CREATE POLICY "Public can view org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

CREATE POLICY "Team managers can upload org logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos'
  AND public.can_manage_team(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Team managers can update org logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos'
  AND public.can_manage_team(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Team managers can delete org logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos'
  AND public.can_manage_team(auth.uid(), ((storage.foldername(name))[1])::uuid)
);