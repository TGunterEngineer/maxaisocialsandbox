// Cron-triggered: scans for due campaigns and enqueues review-request emails.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const internalSecret = req.headers.get('x-internal-secret')
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (internalSecret !== serviceKey && bearer !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const nowIso = new Date().toISOString()
  // App origin for building rating URLs. Falls back to published URL.
  const appOrigin =
    Deno.env.get('APP_PUBLIC_URL') ?? 'https://maxaisocial.lovable.app'

  // Find due campaigns
  const { data: dueCampaigns, error: dueErr } = await supabase
    .from('campaigns')
    .select('id, organization_id, name, subject, message_body, scheduled_at, status, channel')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .limit(20)

  if (dueErr) {
    console.error('Failed to fetch due campaigns', dueErr)
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let processed = 0
  let emailsQueued = 0

  for (const camp of dueCampaigns ?? []) {
    // Mark as sending
    await supabase.from('campaigns').update({ status: 'sending' }).eq('id', camp.id)

    // Load org for branded message
    const { data: org } = await supabase
      .from('organizations')
      .select('name, logo_url, primary_color, email_from_name, support_email, email_footer_text')
      .eq('id', camp.organization_id)
      .maybeSingle()

    // Pending recipients with contact details
    const { data: recipients, error: recErr } = await supabase
      .from('campaign_recipients')
      .select('id, rating_token, send_status, contact_id, contacts(name, email, phone, sms_opt_in)')
      .eq('campaign_id', camp.id)
      .eq('send_status', 'pending')

    if (recErr) {
      console.error('Failed to load recipients', recErr)
      await supabase.from('campaigns').update({ status: 'failed' }).eq('id', camp.id)
      continue
    }

    const isSms = camp.channel === 'sms'

    for (const r of recipients ?? []) {
      const contact = (r as any).contacts
      const ratingUrl = `${appOrigin}/r/${r.rating_token}`

      try {
        let invokeErr: unknown = null

        if (isSms) {
          if (!contact?.phone || !contact?.sms_opt_in) {
            await supabase.from('campaign_recipients')
              .update({ send_status: 'skipped' }).eq('id', r.id)
            continue
          }
          const smsBody = `${camp.message_body}\n\n${ratingUrl}`
          const { error } = await supabase.functions.invoke('send-sms', {
            body: {
              to: contact.phone,
              body: smsBody,
              organizationId: camp.organization_id,
              campaignRecipientId: r.id,
            },
          })
          invokeErr = error
          await supabase.from('campaign_recipients').update({ phone: contact.phone }).eq('id', r.id)
        } else {
          if (!contact?.email) continue
          const { error } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'review-request',
              recipientEmail: contact.email,
              idempotencyKey: `review-req-${r.id}`,
              fromName: org?.email_from_name || org?.name,
              templateData: {
                contactName: contact.name,
                organizationName: org?.name,
                organizationLogoUrl: org?.logo_url ?? undefined,
                brandColor: org?.primary_color ?? undefined,
                supportEmail: org?.support_email ?? undefined,
                footerText: org?.email_footer_text ?? undefined,
                messageBody: camp.message_body,
                ratingUrl,
              },
            },
          })
          invokeErr = error
        }

        if (invokeErr) {
          console.error('Failed to send', invokeErr)
          await supabase
            .from('campaign_recipients')
            .update({ send_status: 'failed' })
            .eq('id', r.id)
        } else {
          await supabase
            .from('campaign_recipients')
            .update({ send_status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', r.id)
          emailsQueued++
        }
      } catch (e) {
        console.error('Exception sending', e)
        await supabase
          .from('campaign_recipients')
          .update({ send_status: 'failed' })
          .eq('id', r.id)
      }
    }

    await supabase.from('campaigns').update({ status: 'sent' }).eq('id', camp.id)
    processed++
  }

  return new Response(
    JSON.stringify({ processed, emailsQueued }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
