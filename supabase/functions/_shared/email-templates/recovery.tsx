/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click below to set a new one.
        </Text>
        <Button style={button} href={confirmationUrl}>Reset password</Button>
        <Text style={footer}>Didn't request this? Ignore this email — your password won't change.</Text>
        <Text style={brand}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', system-ui, -apple-system, Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#444444', lineHeight: '1.6', margin: '0 0 28px' }
const button = { backgroundColor: '#00c8ff', color: '#0a0a0a', fontSize: '15px', fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#888888', margin: '32px 0 0' }
const brand = { fontSize: '12px', color: '#aaaaaa', margin: '24px 0 0', borderTop: '1px solid #eeeeee', paddingTop: '20px', fontWeight: '600' as const }
