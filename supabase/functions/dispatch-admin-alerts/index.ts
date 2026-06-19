// Cron-driven dispatcher for tier-aware admin alerts.
//
// - Starter / Pro tiers  → send one email per pending alert via send-transactional-email.
// - Premium / Founder tiers → batch alerts in a 15-minute window and deliver as
//   a single summary SMS via send-sms (falls back to an email digest if the
//   organization has no `alert_phone` configured).
//
// Trigger this every 5 minutes via pg_cron (see migration / setup_email_infra).
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_WINDOW_MINUTES = 15
const APP_ORIGIN = Deno.env.get('APP_PUBLIC_URL') ?? 'https://maxaisocial.lovable.app'

type Alert = {
  id: string
  organization_id: string
  kind: 'low_rating' | 'campaign_complete'
  payload: Record<string, any>
  created_at: string
}

function summarizeForSms(orgName: string, items: Alert[]): string {
  const lowRatings = items.filter((a) => a.kind === 'low_rating')
  const campaigns = items.filter((a) => a.kind === 'campaign_complete')
  const parts: string[] = [`${orgName}: ${items.length} alert${items.length === 1 ? '' : 's'}`]
  if (lowRatings.length > 0) {
    const avg =
      lowRatings.reduce((s, a) => s + (Number(a.payload?.rating) || 0), 0) / lowRatings.length
    parts.push(`${lowRatings.length} low rating${lowRatings.length === 1 ? '' : 's'} (avg ${avg.toFixed(1)}★)`)
  }
  if (campaigns.length > 0) {
    parts.push(`${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} complete`)
  }
  parts.push(`${APP_ORIGIN}/feedback`)
  return parts.join(' · ').slice(0, 320)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Lock to service-role / cron only.
  const authHeader = req.headers.get('Authorization') ?? ''
  const internalSecret = req.headers.get('x-internal-secret')
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (internalSecret !== serviceKey && bearer !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Pull pending alerts, oldest first. Cap per run to avoid huge bursts.
  const { data: pending, error: pendingErr } = await supabase
    .from('pending_admin_alerts')
    .select('id, organization_id, kind, payload, created_at')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(500)

  if (pendingErr) {
    console.error('Failed to load pending alerts', pendingErr)
    return new Response(JSON.stringify({ error: pendingErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Group by org
  const byOrg = new Map<string, Alert[]>()
  for (const a of pending as Alert[]) {
    const list = byOrg.get(a.organization_id) ?? []
    list.push(a)
    byOrg.set(a.organization_id, list)
  }

  const now = Date.now()
  const batchedWindowMs = BATCH_WINDOW_MINUTES * 60 * 1000
  let dispatched = 0
  let skippedWaiting = 0

  for (const [orgId, alerts] of byOrg) {
    // Resolve org metadata + tier
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, alert_phone, support_email, email_from_name')
      .eq('id', orgId)
      .maybeSingle()

    const { data: tier } = await supabase.rpc('get_org_plan_tier', { _org_id: orgId })
    const planTier = (typeof tier === 'string' ? tier : null)?.toLowerCase() ?? 'starter'
    const isBatchedTier = planTier === 'premium' || planTier === 'founder'

    // Resolve admin/owner emails for fallback delivery
    const { data: admins } = await supabase
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'admin'])
    const adminUserIds = (admins ?? []).map((r) => r.user_id)

    let adminEmails: string[] = []
    if (adminUserIds.length > 0) {
      const { data: users } = await (supabase.auth as any).admin.listUsers()
      const allUsers = users?.users ?? []
      adminEmails = allUsers
        .filter((u: any) => adminUserIds.includes(u.id) && u.email)
        .map((u: any) => u.email as string)
    }

    if (!isBatchedTier) {
      // Starter / Pro → one email per alert, immediately.
      for (const alert of alerts) {
        if (adminEmails.length === 0) {
          await supabase
            .from('pending_admin_alerts')
            .update({ processed_at: new Date().toISOString(), dispatch_channel: 'skipped', dispatch_error: 'no_admin_email' })
            .eq('id', alert.id)
          continue
        }
        const item = {
          kind: alert.kind,
          rating: alert.payload?.rating,
          contactName: alert.payload?.contact_name,
          feedback: alert.payload?.feedback,
          campaignName: alert.payload?.campaign_name,
          locationName: alert.payload?.location_name,
          totalRecipients: alert.payload?.total_recipients,
          sentRecipients: alert.payload?.sent_recipients,
        }
        let lastError: string | null = null
        for (const email of adminEmails) {
          const { error } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'admin-alert-digest',
              recipientEmail: email,
              idempotencyKey: `admin-alert-${alert.id}-${email}`,
              templateData: {
                organizationName: org?.name,
                dashboardUrl: `${APP_ORIGIN}/feedback`,
                items: [item],
              },
            },
          })
          if (error) lastError = String((error as any).message ?? error)
        }
        await supabase
          .from('pending_admin_alerts')
          .update({
            processed_at: new Date().toISOString(),
            dispatch_channel: lastError ? 'email_failed' : 'email',
            dispatch_error: lastError,
          })
          .eq('id', alert.id)
        dispatched++
      }
      continue
    }

    // Premium / Founder → 15-minute batching window.
    // Only flush if the OLDEST pending alert for this org is at least BATCH_WINDOW old.
    const oldest = alerts[0]
    const ageMs = now - new Date(oldest.created_at).getTime()
    if (ageMs < batchedWindowMs) {
      skippedWaiting += alerts.length
      continue
    }

    const items = alerts.map((a) => ({
      kind: a.kind,
      rating: a.payload?.rating,
      contactName: a.payload?.contact_name,
      feedback: a.payload?.feedback,
      campaignName: a.payload?.campaign_name,
      locationName: a.payload?.location_name,
      totalRecipients: a.payload?.total_recipients,
      sentRecipients: a.payload?.sent_recipients,
    }))

    let channel = 'sms'
    let dispatchError: string | null = null

    if (org?.alert_phone) {
      const smsBody = summarizeForSms(org?.name ?? 'Workspace', alerts)
      const { error } = await supabase.functions.invoke('send-sms', {
        body: { to: org.alert_phone, body: smsBody, organizationId: orgId },
      })
      if (error) {
        channel = 'sms_failed_fallback_email'
        dispatchError = String((error as any).message ?? error)
      }
    } else {
      channel = 'email_no_phone'
    }

    // Fallback: also send a digest email if SMS failed or no phone configured.
    if (channel !== 'sms' && adminEmails.length > 0) {
      for (const email of adminEmails) {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'admin-alert-digest',
            recipientEmail: email,
            idempotencyKey: `admin-alert-batch-${alerts[0].id}-${email}`,
            templateData: {
              organizationName: org?.name,
              dashboardUrl: `${APP_ORIGIN}/feedback`,
              items,
            },
          },
        })
      }
    }

    const processedAt = new Date().toISOString()
    await supabase
      .from('pending_admin_alerts')
      .update({ processed_at: processedAt, dispatch_channel: channel, dispatch_error: dispatchError })
      .in('id', alerts.map((a) => a.id))
    dispatched += alerts.length
  }

  return new Response(
    JSON.stringify({ dispatched, skippedWaiting }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
