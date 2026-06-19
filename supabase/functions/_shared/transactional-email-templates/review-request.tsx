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

interface ReviewRequestProps {
  contactName?: string
  organizationName?: string
  organizationLogoUrl?: string
  brandColor?: string
  supportEmail?: string
  footerText?: string
  messageBody?: string
  ratingUrl?: string
}

const ReviewRequestEmail = ({
  contactName,
  organizationName,
  organizationLogoUrl,
  brandColor,
  supportEmail,
  footerText,
  messageBody,
  ratingUrl,
}: ReviewRequestProps) => {
  const greeting = contactName ? `Hi ${contactName},` : 'Hello,'
  const orgName = organizationName || 'us'
  const accent = brandColor && /^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : '#3B82F6'
  const body =
    messageBody ||
    `Thanks for choosing ${orgName}! We'd love to hear about your experience. It only takes 30 seconds.`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>How was your experience with {orgName}?</Preview>
      <Body style={main}>
        <Container style={container}>
          {organizationLogoUrl && (
            <Section style={logoSection}>
              <Img src={organizationLogoUrl} alt={orgName} style={logo} />
            </Section>
          )}
          <Heading style={h1}>How was your experience?</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>{body}</Text>
          {ratingUrl && (
            <Section style={btnSection}>
              <Button href={ratingUrl} style={{ ...buttonBase, backgroundColor: accent }}>
                Rate your experience
              </Button>
            </Section>
          )}
          <Text style={tagline}>
            Your feedback helps {orgName} get better. Thank you!
          </Text>
          {(footerText || supportEmail) && (
            <Section style={footerBox}>
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
  component: ReviewRequestEmail,
  subject: (data: Record<string, any>) =>
    data.organizationName
      ? `How was your experience with ${data.organizationName}?`
      : 'How was your experience?',
  displayName: 'Review request',
  previewData: {
    contactName: 'Alex',
    organizationName: 'Acme Coffee',
    organizationLogoUrl: '',
    brandColor: '#F97316',
    supportEmail: 'hello@acmecoffee.com',
    footerText: '123 Main St, Springfield',
    messageBody:
      "Thanks for stopping by! We'd love to hear how we did — it takes just 30 seconds.",
    ratingUrl: 'https://example.com/r/sampletoken',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const logoSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const logo = { maxHeight: '56px', maxWidth: '200px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.55', margin: '0 0 16px' }
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
const footerBox = { borderTop: '1px solid #e2e8f0', marginTop: '24px', paddingTop: '16px' }
const footerLine = { fontSize: '12px', color: '#94a3b8', margin: '0 0 4px', textAlign: 'center' as const }
