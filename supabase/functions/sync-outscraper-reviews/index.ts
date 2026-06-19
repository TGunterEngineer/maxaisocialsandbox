import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const OUTSCRAPER_BASE = "https://api.outscraper.cloud";

async function awaitOutscraperResults(
  requestId: string,
  apiKey: string,
  maxWaitMs = 90_000,
): Promise<any> {
  const started = Date.now();
  let delay = 2000;
  while (Date.now() - started < maxWaitMs) {
    await new Promise((r) => setTimeout(r, delay));
    const res = await fetch(`${OUTSCRAPER_BASE}/requests/${requestId}`, {
      headers: { "X-API-KEY": apiKey },
    });
    const body = await res.json().catch(() => ({}));
    if (body?.status === "Success") return body;
    if (body?.status === "Failed") throw new Error(body?.error || "Outscraper request failed");
    delay = Math.min(delay + 1000, 6000);
  }
  throw new Error("Timed out waiting for Outscraper results");
}

function reviewTimestamp(r: any): number | null {
  const ts = r.review_timestamp ?? r.timestamp ?? r.published_at_date ?? r.review_datetime_utc;
  if (typeof ts === "number") return ts; // unix seconds
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
  }
  return null;
}

function mapReview(r: any, source = "google") {
  const text = String(r.review_text ?? r.text ?? "").trim();
  if (!text) return null;
  const author = String(r.author_title ?? r.author_name ?? r.reviewer_name ?? "Anonymous").trim();
  let rating: number | null = null;
  const rawRating = r.review_rating ?? r.rating ?? r.stars;
  if (rawRating != null) {
    const n = Number(rawRating);
    if (Number.isFinite(n) && n >= 1 && n <= 5) rating = Math.round(n);
  }
  const tsSec = reviewTimestamp(r);
  const reviewDate = tsSec
    ? new Date(tsSec * 1000).toISOString()
    : new Date().toISOString();
  const externalId = String(
    r.review_id ?? r.id ?? r.review_link ?? `${author}-${reviewDate}`,
  ).slice(0, 200);
  return {
    source,
    external_id: externalId,
    author_name: author.slice(0, 200),
    author_avatar_url: r.author_image ? String(r.author_image).slice(0, 1000) : null,
    rating,
    text: text.slice(0, 5000),
    review_url: r.review_link ? String(r.review_link).slice(0, 1000) : null,
    review_date: reviewDate,
    raw_payload: r,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("OUTSCRAPER_API_KEY");
  if (!apiKey) return json(500, { error: "OUTSCRAPER_API_KEY not configured" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const locationId: string | undefined = body?.location_id;
  const limit: number = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
  const sort: string = body?.sort || "newest";
  // Internal flag: when called from cron-sync-reviews we skip user auth
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal = internalSecret && internalSecret === serviceKey;

  if (!locationId) return json(400, { error: "location_id required" });

  const admin = createClient(supabaseUrl, serviceKey);

  // User auth path
  let userId: string | null = null;
  if (!isInternal) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) return json(401, { error: "Unauthorized" });
    userId = userData.user.id;

    const { data: loc0 } = await admin
      .from("locations")
      .select("organization_id")
      .eq("id", locationId)
      .maybeSingle();
    if (!loc0) return json(404, { error: "Location not found" });
    const { data: canManage } = await admin.rpc("can_manage_team", {
      _user_id: userId,
      _org_id: loc0.organization_id,
    });
    if (!canManage) return json(403, { error: "Forbidden" });
  }

  const { data: loc, error: locErr } = await admin
    .from("locations")
    .select("id, organization_id, google_review_url, name, last_synced_at")
    .eq("id", locationId)
    .maybeSingle();
  if (locErr || !loc) return json(404, { error: "Location not found" });
  if (!loc.google_review_url) {
    return json(400, { error: "Location has no Google review URL set" });
  }

  // ---- Cache guard: skip Outscraper if reviews were synced in the last 24h ----
  const lastSyncMs = loc.last_synced_at ? new Date(loc.last_synced_at).getTime() : 0;
  const hoursSinceSync = lastSyncMs ? (Date.now() - lastSyncMs) / 3_600_000 : Infinity;
  if (hoursSinceSync < 24) {
    const { data: cached, count } = await admin
      .from("reviews")
      .select("id, author_name, rating, text, review_url, review_date", { count: "exact" })
      .eq("organization_id", loc.organization_id)
      .eq("location_id", loc.id)
      .order("review_date", { ascending: false })
      .limit(limit);
    return json(200, {
      cached: true,
      inserted: 0,
      fetched: cached?.length ?? 0,
      filtered: cached?.length ?? 0,
      total_cached: count ?? cached?.length ?? 0,
      location: loc.name,
      last_synced_at: loc.last_synced_at,
      hours_since_sync: Math.round(hoursSinceSync * 10) / 10,
      reviews: cached ?? [],
    });
  }

  // ---- Manual refresh quota (user-triggered only) ----
  if (!isInternal && userId) {
    const { data: quota, error: qErr } = await admin.rpc("consume_manual_refresh", {
      _org_id: loc.organization_id,
      _user_id: userId,
      _location_id: loc.id,
    });
    if (qErr) return json(500, { error: qErr.message });
    if (quota && (quota as any).allowed === false) {
      return json(429, {
        error: "quota_exceeded",
        message: "Daily refresh limit reached for your plan. Automatic background syncing will handle your next update.",
        ...(quota as any),
      });
    }
  }

  // Incremental: cap at last_synced_at if present (with 1h safety overlap)
  const cutoffMs = loc.last_synced_at
    ? new Date(loc.last_synced_at).getTime() - 60 * 60 * 1000
    : null;
  const cutoffSec = cutoffMs ? Math.floor(cutoffMs / 1000) : null;


  const params = new URLSearchParams({
    query: loc.google_review_url,
    reviewsLimit: String(limit),
    sort,
    async: "true",
  });
  if (cutoffSec) params.set("cutoff", String(cutoffSec));

  const startRes = await fetch(`${OUTSCRAPER_BASE}/maps/reviews-v3?${params.toString()}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!startRes.ok) {
    const t = await startRes.text();
    return json(502, { error: `Outscraper start failed [${startRes.status}]: ${t.slice(0, 500)}` });
  }
  const startBody = await startRes.json();
  const requestId = startBody?.id || startBody?.request_id;
  if (!requestId) return json(502, { error: "Outscraper did not return a request id" });

  let result: any;
  try {
    result = await awaitOutscraperResults(requestId, apiKey);
  } catch (e: any) {
    return json(504, { error: e?.message || "Outscraper poll failed" });
  }

  const places: any[] = Array.isArray(result?.data) ? result.data : [];
  const reviewsRaw: any[] = places.flatMap((p) => p?.reviews_data || []);

  // Client-side cutoff filter (defensive — Outscraper sometimes ignores cutoff)
  const filtered = cutoffSec
    ? reviewsRaw.filter((r) => {
        const t = reviewTimestamp(r);
        return t == null || t >= cutoffSec;
      })
    : reviewsRaw;

  const rows = filtered
    .map((r) => mapReview(r, "google"))
    .filter(Boolean)
    .map((r: any) => ({
      ...r,
      organization_id: loc.organization_id,
      location_id: loc.id,
    }));

  let inserted = 0;
  if (rows.length > 0) {
    const { data: upserted, error: upsertErr } = await admin
      .from("reviews")
      .upsert(rows, { onConflict: "organization_id,source,external_id", ignoreDuplicates: false })
      .select("id");
    if (upsertErr) return json(500, { error: upsertErr.message });
    inserted = upserted?.length ?? 0;
  }

  // Always update last_synced_at on success (even if 0 new) so cron skips next time
  await admin
    .from("locations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", loc.id);

  return json(200, {
    inserted,
    fetched: reviewsRaw.length,
    filtered: filtered.length,
    location: loc.name,
    incremental: !!cutoffSec,
  });
});
