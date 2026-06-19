import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface LowRatingAlertProps {
  rating?: number
  contactName?: string
  feedback?: string
  campaignName?: string
  locationName?: string
  dashboardUrl?: string
}

const LowRatingAlertEmail = ({
  rating,
  contactName,
  feedback,
  campaignName,
  locationName,
  dashboardUrl,
}: LowRatingAlertProps) => {
  const stars = '★'.repeat(rating ?? 1) + '☆'.repeat(5 - (rating ?? 1))
  const who = contactName || 'A customer'
  const url = dashboardUrl || 'https://maxaisocial.lovable.app/feedback'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${who} just left a ${rating ?? ''}-star rating`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={alertBar}>
            <Text style={alertText}>⚠️ Low rating alert</Text>
          </Section>
          <Heading style={h1}>{who} rated you {rating}/5</Heading>
          <Text style={starLine}>{stars}</Text>

          <Section style={quoteBox}>
            <Text style={quoteText}>"{feedback || 'No additional feedback provided.'}"</Text>
          </Section>

          <Section style={metaBox}>
            {campaignName && <Text style={metaLine}><strong>Campaign:</strong> {campaignName}</Text>}
            {locationName && <Text style={metaLine}><strong>Location:</strong> {locationName}</Text>}
          </Section>

          <Section style={btnSection}>
            <Button href={url} style={button}>View &amp; respond</Button>
          </Section>

          <Text style={tip}>
            💡 Responding within 24 hours dramatically improves customer recovery rates.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: LowRatingAlertEmail,
  subject: (data: Record<string, any>) =>
    `⚠️ ${data.rating ?? ''}★ rating from ${data.contactName || 'a customer'}`,
  displayName: 'Low rating alert',
  previewData: {
    rating: 2,
    contactName: 'Alex Johnson',
    feedback: 'Service was slow and the order was wrong. Disappointed.',
    campaignName: 'October post-visit follow-up',
    locationName: 'Downtown',
    dashboardUrl: 'https://maxaisocial.lovable.app/feedback',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const alertBar = { backgroundColor: '#fef2f2', borderLeft: '4px solid #dc2626', padding: '10px 14px', borderRadius: '4px', margin: '0 0 20px' }
const alertText = { fontSize: '13px', color: '#991b1b', margin: 0, fontWeight: 600 }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px' }
const starLine = { fontSize: '20px', color: '#f59e0b', margin: '0 0 20px', letterSpacing: '2px' }
const quoteBox = { backgroundColor: '#f8fafc', padding: '16px 18px', borderRadius: '8px', margin: '0 0 16px' }
const quoteText = { fontSize: '15px', color: '#334155', lineHeight: '1.55', margin: 0, fontStyle: 'italic' as const }
const metaBox = { margin: '0 0 24px' }
const metaLine = { fontSize: '13px', color: '#64748b', margin: '0 0 4px' }
const btnSection = { textAlign: 'center' as const, margin: '24px 0' }
const button = { backgroundColor: '#3B82F6', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }
const tip = { fontSize: '13px', color: '#64748b', margin: '20px 0 0', textAlign: 'center' as const }
