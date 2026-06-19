import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AdminAlertItem {
  kind: 'low_rating' | 'campaign_complete'
  rating?: number
  contactName?: string
  feedback?: string
  campaignName?: string
  locationName?: string
  totalRecipients?: number
  sentRecipients?: number
}

interface AdminAlertDigestProps {
  organizationName?: string
  dashboardUrl?: string
  items?: AdminAlertItem[]
}

const renderItem = (item: AdminAlertItem, idx: number) => {
  if (item.kind === 'low_rating') {
    const stars = '★'.repeat(item.rating ?? 1) + '☆'.repeat(5 - (item.rating ?? 1))
    return (
      <Section key={idx} style={itemBox}>
        <Text style={itemTitle}>
          {item.contactName || 'A customer'} — {stars} ({item.rating ?? '?'}/5)
        </Text>
        {item.feedback && <Text style={itemBody}>"{item.feedback}"</Text>}
        {(item.campaignName || item.locationName) && (
          <Text style={itemMeta}>
            {[item.campaignName, item.locationName].filter(Boolean).join(' · ')}
          </Text>
        )}
      </Section>
    )
  }
  return (
    <Section key={idx} style={itemBox}>
      <Text style={itemTitle}>Campaign complete: {item.campaignName || 'Untitled'}</Text>
      <Text style={itemMeta}>
        {item.sentRecipients ?? 0} of {item.totalRecipients ?? 0} recipients sent
      </Text>
    </Section>
  )
}

const AdminAlertDigestEmail = ({
  organizationName,
  dashboardUrl,
  items,
}: AdminAlertDigestProps) => {
  const list = items ?? []
  const url = dashboardUrl || 'https://maxaisocial.lovable.app'
  const orgName = organizationName || 'your workspace'
  const summary =
    list.length === 1
      ? '1 new admin alert'
      : `${list.length} new admin alerts`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{summary} for {orgName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{summary}</Heading>
          <Text style={lede}>Recent activity in {orgName}.</Text>
          <Hr style={hr} />
          {list.map(renderItem)}
          <Section style={{ textAlign: 'center', margin: '28px 0 0' }}>
            <Button href={url} style={button}>Open dashboard</Button>
          </Section>
          <Text style={footer}>
            You're receiving this because you're an admin on {orgName}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdminAlertDigestEmail,
  subject: (data: Record<string, any>) => {
    const n = Array.isArray(data?.items) ? data.items.length : 0
    return n === 1 ? 'New admin alert' : `${n} new admin alerts`
  },
  displayName: 'Admin alert digest',
  previewData: {
    organizationName: 'Acme Inc.',
    dashboardUrl: 'https://maxaisocial.lovable.app',
    items: [
      { kind: 'low_rating', rating: 2, contactName: 'Jane', feedback: 'Slow service', campaignName: 'May follow-ups', locationName: 'Downtown' },
      { kind: 'campaign_complete', campaignName: 'May follow-ups', totalRecipients: 120, sentRecipients: 118 },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px' }
const lede = { fontSize: '14px', color: '#475569', margin: '0 0 8px' }
const hr = { borderColor: '#e2e8f0', margin: '16px 0' }
const itemBox = { padding: '12px 14px', borderLeft: '3px solid #3B82F6', backgroundColor: '#f8fafc', borderRadius: '6px', margin: '0 0 12px' }
const itemTitle = { fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }
const itemBody = { fontSize: '13px', color: '#334155', margin: '0 0 6px', fontStyle: 'italic' }
const itemMeta = { fontSize: '12px', color: '#64748b', margin: 0 }
const button = { backgroundColor: '#3B82F6', color: '#ffffff', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0', textAlign: 'center' as const }
