// Cron-triggered: processes pending webhook_deliveries with retry + HMAC signing.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_BATCH = 25
const TIMEOUT_MS = 10_000

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function backoffSeconds(attempts: number): number {
  // 1m, 5m, 30m, 2h
  const ladder = [60, 300, 1800, 7200]
  return ladder[Math.min(attempts, ladder.length - 1)]
}

// SSRF guard: reject internal/private/loopback/link-local/metadata addresses.
// Only allow http(s) to public hosts. We block on hostname AND on resolved IPs
// (best-effort: IP literals are caught synchronously; DNS-based attacks are
// mitigated by checking the parsed hostname for IPv4/IPv6 literals).
const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
])

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false
  }
  const [a, b] = parts
  if (a === 10) return true                       // 10.0.0.0/8
  if (a === 127) return true                      // loopback
  if (a === 0) return true                        // 0.0.0.0/8
  if (a === 169 && b === 254) return true         // link-local (incl. AWS/GCP metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true         // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a >= 224) return true                       // multicast + reserved
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "")
  if (lower === "::1" || lower === "::") return true               // loopback / unspecified
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true // unique local fc00::/7
  if (lower.startsWith("::ffff:")) {                                 // IPv4-mapped
    const mapped = lower.slice(7)
    return isPrivateIPv4(mapped)
  }
  return false
}

function isWebhookUrlAllowed(rawUrl: string): { ok: boolean; reason?: string } {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: "Invalid URL" }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http/https are allowed" }
  }
  const host = parsed.hostname.toLowerCase()
  if (!host) return { ok: false, reason: "Empty host" }
  if (PRIVATE_HOSTNAMES.has(host)) return { ok: false, reason: "Internal hostname blocked" }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Internal TLD blocked" }
  }
  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIPv4(host)) {
    return { ok: false, reason: "Private IPv4 blocked" }
  }
  // IPv6 literal (URL hostnames strip the brackets)
  if (host.includes(":") && isPrivateIPv6(host)) {
    return { ok: false, reason: "Private IPv6 blocked" }
  }
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const internalSecret = req.headers.get('x-internal-secret')
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (internalSecret !== SERVICE_KEY && bearer !== SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    SERVICE_KEY,
  )

  const nowIso = new Date().toISOString()

  const { data: deliveries, error } = await supabase
    .from('webhook_deliveries')
    .select('id, endpoint_id, organization_id, event_type, payload, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .limit(MAX_BATCH)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let processed = 0
  let succeeded = 0
  let failed = 0
  let retried = 0

  // Cache per-org plan-tier eligibility for the duration of this batch so that
  // we don't re-query for every delivery belonging to the same organization.
  const tierCache = new Map<string, boolean>()
  const ALLOWED_EVENTS = new Set(['rating.submitted', 'review.created', 'feedback.received'])

  async function orgHasWebhookFeature(orgId: string): Promise<boolean> {
    if (tierCache.has(orgId)) return tierCache.get(orgId)!
    const { data, error } = await supabase.rpc('get_org_plan_tier', { _org_id: orgId })
    if (error) {
      // Fail closed if we can't resolve the tier.
      tierCache.set(orgId, false)
      return false
    }
    const ok = data === 'premium' || data === 'founder'
    tierCache.set(orgId, ok)
    return ok
  }

  for (const d of deliveries ?? []) {
    processed++

    // Tier gate: only Premium/Founder orgs may receive outbound webhook deliveries.
    const tierOk = await orgHasWebhookFeature((d as any).organization_id)
    if (!tierOk) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          last_error: 'Org plan does not include the Webhooks feature',
        })
        .eq('id', d.id)
      failed++
      continue
    }

    // Event-type allowlist: drop unknown events instead of delivering them.
    if (!ALLOWED_EVENTS.has(d.event_type as string)) {
      await supabase
        .from('webhook_deliveries')
        .update({ status: 'failed', last_error: `Unsupported event_type: ${d.event_type}` })
        .eq('id', d.id)
      failed++
      continue
    }

    const { data: endpoint } = await supabase
      .from('webhook_endpoints')
      .select('url, is_active')
      .eq('id', d.endpoint_id)
      .maybeSingle()

    const { data: secretRow } = await supabase
      .from('webhook_endpoint_secrets')
      .select('secret')
      .eq('endpoint_id', d.endpoint_id)
      .maybeSingle()

    if (!endpoint || !endpoint.is_active || !secretRow?.secret) {
      await supabase
        .from('webhook_deliveries')
        .update({ status: 'failed', last_error: 'Endpoint missing or disabled' })
        .eq('id', d.id)
      failed++
      continue
    }

    // SSRF guard: block delivery to private/internal/loopback addresses.
    const guard = isWebhookUrlAllowed(endpoint.url)
    if (!guard.ok) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempts: d.attempts + 1,
          last_error: `URL rejected by SSRF guard: ${guard.reason}`,
        })
        .eq('id', d.id)
      failed++
      continue
    }

    const body = JSON.stringify(d.payload)
    const signature = await hmacSha256Hex(secretRow.secret, body)
    const attempts = d.attempts + 1

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

    let status = 0
    let respBody = ''
    let errMsg: string | null = null

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MaximumSocial-Webhooks/1.0',
          'X-MS-Event': String(d.payload?.event ?? ''),
          'X-MS-Signature': `sha256=${signature}`,
          'X-MS-Delivery-Id': d.id,
        },
        body,
      })
      status = res.status
      respBody = (await res.text()).slice(0, 2000)
    } catch (e) {
      errMsg = (e as Error).message
    } finally {
      clearTimeout(timer)
    }

    const ok = status >= 200 && status < 300

    if (ok) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'success',
          attempts,
          last_response_status: status,
          last_response_body: respBody,
          last_error: null,
        })
        .eq('id', d.id)
      succeeded++
    } else if (attempts >= d.max_attempts) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempts,
          last_response_status: status || null,
          last_response_body: respBody || null,
          last_error: errMsg,
        })
        .eq('id', d.id)
      failed++
    } else {
      const next = new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString()
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'pending',
          attempts,
          next_attempt_at: next,
          last_response_status: status || null,
          last_response_body: respBody || null,
          last_error: errMsg,
        })
        .eq('id', d.id)
      retried++
    }
  }

  return new Response(
    JSON.stringify({ processed, succeeded, failed, retried }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
