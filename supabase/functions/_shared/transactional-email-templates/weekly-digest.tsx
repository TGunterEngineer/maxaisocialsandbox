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
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface WeeklyDigestProps {
  organizationName?: string
  weekRange?: string
  totals?: {
    newReviews?: number
    avgRating?: number
    lowRatings?: number
    repliesSent?: number
    campaignsSent?: number
  }
  insights?: string[]
  recommendations?: string[]
  dashboardUrl?: string
}

const WeeklyDigestEmail = ({
  organizationName,
  weekRange,
  totals,
  insights,
  recommendations,
  dashboardUrl,
}: WeeklyDigestProps) => {
  const orgName = organizationName || 'your business'
  const url = dashboardUrl || 'https://maxaisocial.lovable.app/'
  const t = totals || {}

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Your week in reviews — ${weekRange || 'last 7 days'}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your weekly digest</Heading>
          <Text style={sub}>{orgName} · {weekRange || 'Last 7 days'}</Text>

          <Section style={statGrid}>
            <Stat label="New reviews" value={String(t.newReviews ?? 0)} />
            <Stat label="Avg rating" value={t.avgRating != null ? `${t.avgRating.toFixed(1)}★` : '—'} />
            <Stat label="Low ratings" value={String(t.lowRatings ?? 0)} accent={(t.lowRatings ?? 0) > 0} />
            <Stat label="Replies sent" value={String(t.repliesSent ?? 0)} />
          </Section>

          <Hr style={hr} />

          <Heading as="h2" style={h2}>🧠 AI insights</Heading>
          {(insights && insights.length > 0) ? (
            insights.map((line, i) => (
              <Text key={i} style={bullet}>• {line}</Text>
            ))
          ) : (
            <Text style={text}>Not enough activity this week to surface insights yet.</Text>
          )}

          {recommendations && recommendations.length > 0 && (
            <>
              <Heading as="h2" style={h2}>✅ Recommended actions</Heading>
              {recommendations.map((line, i) => (
                <Text key={i} style={bullet}>• {line}</Text>
              ))}
            </>
          )}

          <Section style={btnSection}>
            <Button href={url} style={button}>Open dashboard</Button>
          </Section>

          <Text style={footer}>
            You receive this because you're an owner of {orgName}. We send one digest per week.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div style={statCell as React.CSSProperties}>
    <Text style={{ ...statValue, color: accent ? '#dc2626' : '#0f172a' }}>{value}</Text>
    <Text style={statLabel}>{label}</Text>
  </div>
)

export const template = {
  component: WeeklyDigestEmail,
  subject: (data: Record<string, any>) =>
    `Your week in reviews${data.organizationName ? ` — ${data.organizationName}` : ''}`,
  displayName: 'Weekly digest',
  previewData: {
    organizationName: 'Acme Coffee',
    weekRange: 'Apr 14 – Apr 20',
    totals: { newReviews: 23, avgRating: 4.6, lowRatings: 2, repliesSent: 18, campaignsSent: 3 },
    insights: [
      'Average rating ticked up 0.3★ vs prior week — strongest week this month.',
      'Two negative reviews mention "wait time" — recurring theme.',
      'Downtown location drove 60% of new reviews.',
    ],
    recommendations: [
      'Reply to the 2 low ratings — none have been responded to yet.',
      'Run a follow-up campaign to last week\'s high-rating contacts to boost Google reviews.',
    ],
    dashboardUrl: 'https://maxaisocial.lovable.app/',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px' }
const h2 = { fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '24px 0 10px' }
const sub = { fontSize: '13px', color: '#64748b', margin: '0 0 20px' }
const statGrid = { display: 'block', margin: '8px 0 0' }
const statCell = { display: 'inline-block', width: '24%', textAlign: 'center', verticalAlign: 'top', padding: '8px 4px' }
const statValue = { fontSize: '22px', fontWeight: 'bold', margin: 0 }
const statLabel = { fontSize: '11px', color: '#64748b', margin: '2px 0 0', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.55', margin: '0 0 8px' }
const bullet = { fontSize: '14px', color: '#334155', lineHeight: '1.55', margin: '0 0 6px' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const btnSection = { textAlign: 'center' as const, margin: '28px 0 16px' }
const button = { backgroundColor: '#3B82F6', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '20px 0 0', textAlign: 'center' as const }
