// Sends a single SMS via Twilio gateway. Called per recipient by process-review-campaigns.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { to, body, organizationId, campaignRecipientId } = await req.json()

    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'to and body are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
    const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER')
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_FROM_NUMBER) {
      return new Response(JSON.stringify({ error: 'SMS sending is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // --- Authorize the caller against the requested organization ---
    // Cron / internal callers may pass the service-role key (auth.role === 'service_role'),
    // in which case we trust them. Otherwise the JWT subject must be a member of the org.
    // This function is internal-only: it is invoked by `process-review-campaigns`
    // using the service-role key. We do NOT accept user JWTs, since allowing any
    // org member to call this would let them send arbitrary SMS to arbitrary
    // numbers via the platform's Twilio credentials (harassment / quota drain).
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Plan quota check
    if (organizationId) {
      const { data: quota, error: quotaErr } = await supabase.rpc('can_send_sms', { _org_id: organizationId })
      if (!quotaErr && quota && (quota as any).allowed === false) {
        await supabase.from('sms_send_log').insert({
          organization_id: organizationId, campaign_recipient_id: campaignRecipientId,
          recipient_phone: to, status: 'blocked',
          error_message: `plan_limit:${(quota as any).reason}:${(quota as any).used}/${(quota as any).limit}`,
        })
        return new Response(JSON.stringify({ status: 'blocked', reason: (quota as any).reason, used: (quota as any).used, limit: (quota as any).limit }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Suppression check
    const { data: suppressed } = await supabase
      .from('sms_suppressions').select('id').eq('phone', to).maybeSingle()
    if (suppressed) {
      await supabase.from('sms_send_log').insert({
        organization_id: organizationId, campaign_recipient_id: campaignRecipientId,
        recipient_phone: to, status: 'suppressed',
      })
      return new Response(JSON.stringify({ status: 'suppressed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fullBody = `${body}\n\nReply STOP to opt out.`

    const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: fullBody }),
    })
    const data = await res.json()

    if (!res.ok) {
      await supabase.from('sms_send_log').insert({
        organization_id: organizationId, campaign_recipient_id: campaignRecipientId,
        recipient_phone: to, status: 'failed',
        error_message: typeof data === 'object' ? JSON.stringify(data).slice(0, 1000) : String(data),
      })
      return new Response(JSON.stringify({ error: data }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('sms_send_log').insert({
      organization_id: organizationId, campaign_recipient_id: campaignRecipientId,
      recipient_phone: to, status: 'sent', message_sid: data.sid,
    })

    return new Response(JSON.stringify({ status: 'sent', sid: data.sid }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
