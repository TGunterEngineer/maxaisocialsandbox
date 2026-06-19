/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>This code expires shortly. Didn't request it? Safe to ignore.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', system-ui, -apple-system, Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#444444', lineHeight: '1.6', margin: '0 0 28px' }
const codeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  letterSpacing: '0.2em',
  background: '#f5f5f5',
  padding: '16px 24px',
  borderRadius: '8px',
  display: 'inline-block',
  margin: '0 0 30px',
}
const footer = { fontSize: '13px', color: '#888888', margin: '32px 0 0' }
