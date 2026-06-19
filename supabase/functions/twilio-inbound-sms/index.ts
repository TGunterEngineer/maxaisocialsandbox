// Twilio inbound SMS webhook — handles STOP / HELP keywords.
// Twilio posts application/x-www-form-urlencoded.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
}

function twiml(message?: string) {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`
  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  })
}

const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']
const START_WORDS = ['start', 'unstop', 'yes']
const HELP_WORDS = ['help', 'info']

// Twilio's signature: HMAC-SHA1(authToken, requestUrl + sortedConcatenatedFormParams), base64.
async function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): Promise<string> {
  const sorted = Object.keys(params).sort()
  let payload = url
  for (const k of sorted) payload += k + params[k]
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  // base64
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return twiml()

  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured — rejecting inbound SMS')
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  const signature = req.headers.get('X-Twilio-Signature') ?? ''
  if (!signature) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  // Read raw body once, then parse as form data.
  const rawBody = await req.text()
  const form = new URLSearchParams(rawBody)
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = v

  // Twilio signs the URL it called. Behind proxies, prefer x-forwarded headers if present.
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const incoming = new URL(req.url)
  const url = `${proto}://${host}${incoming.pathname}${incoming.search}`

  const expected = await computeTwilioSignature(authToken, url, params)
  if (!timingSafeEqual(signature, expected)) {
    // Try once more without query string in case Twilio configured the bare path.
    const altUrl = `${proto}://${host}${incoming.pathname}`
    const expectedAlt = await computeTwilioSignature(authToken, altUrl, params)
    if (!timingSafeEqual(signature, expectedAlt)) {
      console.warn('Invalid Twilio signature')
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const from = (params.From ?? '').trim()
  const bodyText = (params.Body ?? '').trim().toLowerCase()
  if (!from) return twiml()

  if (STOP_WORDS.includes(bodyText)) {
    await supabase.from('sms_suppressions').upsert(
      { phone: from, reason: 'stop', metadata: { keyword: bodyText } },
      { onConflict: 'phone' },
    )
    await supabase.from('contacts').update({ sms_opt_in: false }).eq('phone', from)
    return twiml("You've been unsubscribed. Reply START to opt back in.")
  }

  if (START_WORDS.includes(bodyText)) {
    await supabase.from('sms_suppressions').delete().eq('phone', from)
    return twiml("You're opted back in. Reply STOP at any time to unsubscribe.")
  }

  if (HELP_WORDS.includes(bodyText)) {
    return twiml('Reviews & feedback service. Reply STOP to opt out. Msg & data rates may apply.')
  }

  return twiml()
})
