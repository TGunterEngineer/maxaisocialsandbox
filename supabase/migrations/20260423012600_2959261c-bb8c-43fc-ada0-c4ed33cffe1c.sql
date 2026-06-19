-- Drop the broad public read policy and replace with a stricter pair:
-- 1) Public can only read direct file URLs (via storage CDN bypasses LIST).
--    To be safe we restrict LIST to org members; direct GET still works through the public CDN.
-- Note: With public buckets, the storage CDN serves files via signed/public URLs without RLS;
-- the policy below controls the data-API LIST/GET path only.

DROP POLICY IF EXISTS "Public can view org logos" ON storage.objects;

-- Org members can list/read their own org's logo objects via data API
CREATE POLICY "Org members can list their org logos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'org-logos'
  AND auth.uid() IS NOT NULL
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);