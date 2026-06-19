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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>Click below to log in to {siteName}. This link expires shortly.</Text>
        <Button style={button} href={confirmationUrl}>Log in</Button>
        <Text style={footer}>Didn't request this? Safe to ignore.</Text>
        <Text style={brand}>{siteName}</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', system-ui, -apple-system, Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#444444', lineHeight: '1.6', margin: '0 0 28px' }
const button = { backgroundColor: '#00c8ff', color: '#0a0a0a', fontSize: '15px', fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#888888', margin: '32px 0 0' }
const brand = { fontSize: '12px', color: '#aaaaaa', margin: '24px 0 0', borderTop: '1px solid #eeeeee', paddingTop: '20px', fontWeight: '600' as const }
