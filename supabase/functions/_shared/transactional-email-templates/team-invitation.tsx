import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface TeamInvitationProps {
  inviterName?: string
  organizationName?: string
  organizationLogoUrl?: string
  brandColor?: string
  supportEmail?: string
  footerText?: string
  role?: string
  acceptUrl?: string
}

const roleCopy: Record<string, string> = {
  admin: 'Admin — full access to settings, team, and all locations',
  member: 'Member — can manage campaigns and contacts on assigned locations',
  viewer: 'Viewer — read-only access to assigned locations',
}

const TeamInvitationEmail = ({
  inviterName,
  organizationName,
  organizationLogoUrl,
  brandColor,
  supportEmail,
  footerText,
  role,
  acceptUrl,
}: TeamInvitationProps) => {
  const orgName = organizationName || 'a workspace'
  const inviter = inviterName || 'A teammate'
  const roleLabel = role ? roleCopy[role] ?? role : ''
  const accent = brandColor && /^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : '#3B82F6'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{inviter} invited you to join {orgName}</Preview>
      <Body style={main}>
        <Container style={container}>
          {organizationLogoUrl && (
            <Section style={logoSection}>
              <Img src={organizationLogoUrl} alt={orgName} style={logo} />
            </Section>
          )}
          <Heading style={h1}>You're invited to {orgName}</Heading>
          <Text style={text}>
            <strong>{inviter}</strong> has invited you to collaborate on{' '}
            <strong>{orgName}</strong>.
          </Text>
          {roleLabel && (
            <Section style={roleBox}>
              <Text style={roleText}>{roleLabel}</Text>
            </Section>
          )}
          {acceptUrl && (
            <Section style={btnSection}>
              <Button href={acceptUrl} style={{ ...buttonBase, backgroundColor: accent }}>
                Accept invitation
              </Button>
            </Section>
          )}
          <Text style={tagline}>
            This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.
          </Text>
          {(footerText || supportEmail) && (
            <Section style={footerBoxStyle}>
              {footerText && <Text style={footerLine}>{footerText}</Text>}
              {supportEmail && (
                <Text style={footerLine}>
                  Questions? Reach us at <a href={`mailto:${supportEmail}`} style={{ color: accent }}>{supportEmail}</a>
                </Text>
              )}
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TeamInvitationEmail,
  subject: (data: Record<string, any>) =>
    data.organizationName
      ? `You're invited to join ${data.organizationName}`
      : "You've been invited to a workspace",
  displayName: 'Team invitation',
  previewData: {
    inviterName: 'Sarah',
    organizationName: 'Maximum Social',
    organizationLogoUrl: '',
    brandColor: '#3B82F6',
    supportEmail: 'support@example.com',
    footerText: '',
    role: 'member',
    acceptUrl: 'https://example.com/invite/sampletoken',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const logoSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const logo = { maxHeight: '56px', maxWidth: '200px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.55', margin: '0 0 16px' }
const roleBox = {
  backgroundColor: '#f1f5f9',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '16px 0 24px',
}
const roleText = { fontSize: '14px', color: '#0f172a', margin: 0 }
const btnSection = { textAlign: 'center' as const, margin: '28px 0' }
const buttonBase = {
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 600,
  display: 'inline-block',
}
const tagline = { fontSize: '13px', color: '#64748b', margin: '24px 0 0' }
const footerBoxStyle = { borderTop: '1px solid #e2e8f0', marginTop: '24px', paddingTop: '16px' }
const footerLine = { fontSize: '12px', color: '#94a3b8', margin: '0 0 4px', textAlign: 'center' as const }
