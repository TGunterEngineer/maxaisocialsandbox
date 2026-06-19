
-- Cleanup orphans for the missing FKs only
UPDATE public.campaigns SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth.users);
DELETE FROM public.founder_slots WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.notifications WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.review_ingest_keys WHERE created_by NOT IN (SELECT id FROM auth.users);
DELETE FROM public.sms_send_log WHERE organization_id IS NOT NULL AND organization_id NOT IN (SELECT id FROM public.organizations);
UPDATE public.sms_send_log SET campaign_recipient_id = NULL WHERE campaign_recipient_id IS NOT NULL AND campaign_recipient_id NOT IN (SELECT id FROM public.campaign_recipients);
UPDATE public.subscriptions SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.team_invitations WHERE invited_by NOT IN (SELECT id FROM auth.users);
UPDATE public.team_invitations SET accepted_by = NULL WHERE accepted_by IS NOT NULL AND accepted_by NOT IN (SELECT id FROM auth.users);
DELETE FROM public.team_invitation_tokens WHERE invitation_id NOT IN (SELECT id FROM public.team_invitations);
DELETE FROM public.webhook_endpoints WHERE created_by NOT IN (SELECT id FROM auth.users);
DELETE FROM public.webhook_endpoint_secrets WHERE endpoint_id NOT IN (SELECT id FROM public.webhook_endpoints);
DELETE FROM public.webhook_deliveries WHERE organization_id NOT IN (SELECT id FROM public.organizations);

-- Add missing FKs
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.founder_slots
  ADD CONSTRAINT founder_slots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.review_ingest_keys
  ADD CONSTRAINT review_ingest_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.sms_send_log
  ADD CONSTRAINT sms_send_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD CONSTRAINT sms_send_log_campaign_recipient_id_fkey FOREIGN KEY (campaign_recipient_id) REFERENCES public.campaign_recipients(id) ON DELETE SET NULL;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT team_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.team_invitation_tokens
  ADD CONSTRAINT team_invitation_tokens_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.team_invitations(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_endpoint_secrets
  ADD CONSTRAINT webhook_endpoint_secrets_endpoint_id_fkey FOREIGN KEY (endpoint_id) REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Indexes on FK columns
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_organization_id ON public.user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_location_access_location_id ON public.user_location_access(location_id);
CREATE INDEX IF NOT EXISTS idx_user_location_access_organization_id ON public.user_location_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON public.locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_reviews_organization_id ON public.reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_reviews_location_id ON public.reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_location_id ON public.contacts(location_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_organization_id ON public.campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_contact_id ON public.campaign_recipients(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_organization_id ON public.campaign_recipients(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_organization_id ON public.feedback_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_log_organization_id ON public.sms_send_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_organization_id ON public.team_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_by ON public.team_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_organization_id ON public.webhook_endpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON public.webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_organization_id ON public.webhook_deliveries(organization_id);
