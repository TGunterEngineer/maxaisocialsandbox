-- Re-assert that the secret rating_token column is not readable by app users.
-- The general SELECT policy on campaign_recipients permits org members to see rows,
-- but the rating_token column must remain hidden from authenticated/anon roles.
REVOKE SELECT (rating_token) ON public.campaign_recipients FROM anon, authenticated;