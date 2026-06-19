// Cron-triggered: scans all locations with Google review URLs and syncs them
// based on each org's plan tier (Starter weekly, Pro/Founder daily).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimum hours between automated syncs per plan tier
function syncIntervalHours(plan: string | null): number | null {
  switch (plan) {
    case "founder": return 24;
    case "pro": return 24;
    case "starter": return 24 * 7; // weekly
    default: return null; // no subscription = no automated sync
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const internalSecret = req.headers.get("x-internal-secret");
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (internalSecret !== serviceKey && bearer !== serviceKey) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Pull all locations with a Google URL, joined with their org's plan
  const { data: locations, error } = await admin
    .from("locations")
    .select("id, organization_id, name, google_review_url, last_synced_at")
    .not("google_review_url", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const results: any[] = [];
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const loc of locations ?? []) {
    // Resolve org plan tier
    const { data: planTier } = await admin.rpc("get_org_plan_tier", {
      _org_id: loc.organization_id,
    });
    const interval = syncIntervalHours(planTier as string | null);

    if (interval == null) {
      skipped++;
      results.push({ id: loc.id, name: loc.name, skipped: "no_subscription" });
      continue;
    }

    if (loc.last_synced_at) {
      const last = new Date(loc.last_synced_at).getTime();
      const hoursSince = (now - last) / (1000 * 60 * 60);
      // Hard 24h cache floor: never re-hit Outscraper within a day of a successful sync.
      const effectiveInterval = Math.max(interval, 24);
      if (hoursSince < effectiveInterval) {
        skipped++;
        results.push({ id: loc.id, name: loc.name, skipped: "cache_fresh", hoursSince: Math.round(hoursSince) });
        continue;
      }
    }


    // Invoke sync function with internal auth
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-outscraper-reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-internal-secret": serviceKey,
        },
        body: JSON.stringify({ location_id: loc.id, limit: 50, sort: "newest" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        failed++;
        results.push({ id: loc.id, name: loc.name, failed: body?.error || res.status });
      } else {
        synced++;
        results.push({ id: loc.id, name: loc.name, inserted: body?.inserted ?? 0 });
      }
    } catch (e: any) {
      failed++;
      results.push({ id: loc.id, name: loc.name, failed: e?.message || "exception" });
    }
  }

  return new Response(
    JSON.stringify({ synced, skipped, failed, total: locations?.length ?? 0, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
