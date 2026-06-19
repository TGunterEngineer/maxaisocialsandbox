import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOURCES = ["google","facebook","instagram","yelp","trustpilot","manual","webhook","outscraper","other"] as const;

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "Method not allowed");

  const ingestKey = req.headers.get("x-ingest-key");
  if (!ingestKey) return bad(401, "Missing x-ingest-key header");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: keyRow, error: keyErr } = await admin
    .from("review_ingest_keys")
    .select("id, organization_id, is_active")
    .eq("key", ingestKey)
    .maybeSingle();

  if (keyErr || !keyRow || !keyRow.is_active) return bad(401, "Invalid ingest key");

  // Per-key rate limit: 600 requests / minute (each request can carry multiple reviews).
  const { data: rlOk } = await admin.rpc("check_rate_limit", {
    _bucket: "ingest_review",
    _identifier: keyRow.id,
    _max_attempts: 600,
    _window_minutes: 1,
  });
  if (rlOk === false) return bad(429, "Rate limit exceeded");

  let body: any;
  try { body = await req.json(); } catch { return bad(400, "Invalid JSON body"); }

  const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.reviews) ? body.reviews : [body];
  const rows: any[] = [];
  const errors: any[] = [];

  for (const [i, it] of items.entries()) {
    if (!it || typeof it !== "object") { errors.push({ index: i, error: "Not an object" }); continue; }
    const source = String(it.source || "webhook").toLowerCase();
    if (!SOURCES.includes(source as any)) { errors.push({ index: i, error: `Invalid source '${source}'` }); continue; }
    const author = String(it.author_name || it.author || "").trim();
    const text = String(it.text || it.review_text || it.content || "").trim();
    if (!author) { errors.push({ index: i, error: "author_name required" }); continue; }
    // text is now optional — Google "rating-only" reviews have no body.
    let rating: number | null = null;
    if (it.rating != null) {
      const r = Number(it.rating);
      if (!Number.isFinite(r) || r < 1 || r > 5) { errors.push({ index: i, error: "rating must be 1-5" }); continue; }
      rating = Math.round(r);
    }
    // Require at least a rating OR text — empty rows are useless.
    if (!text && rating == null) {
      errors.push({ index: i, error: "either rating or text required" });
      continue;
    }
    rows.push({
      organization_id: keyRow.organization_id,
      source,
      external_id: it.external_id ? String(it.external_id) : null,
      author_name: author.slice(0, 200),
      author_avatar_url: it.author_avatar_url ? String(it.author_avatar_url).slice(0, 1000) : null,
      rating,
      text: text ? text.slice(0, 5000) : null,
      review_url: it.review_url ? String(it.review_url).slice(0, 1000) : null,
      review_date: it.review_date ? new Date(it.review_date).toISOString() : new Date().toISOString(),
      raw_payload: it,
    });
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ inserted: 0, errors }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: inserted, error: insertErr } = await admin
    .from("reviews")
    .upsert(rows, { onConflict: "organization_id,source,external_id", ignoreDuplicates: false })
    .select("id");

  if (insertErr) {
    console.error("ingest-review DB error:", insertErr);
    return bad(500, "Failed to store reviews");
  }

  await admin.from("review_ingest_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

  return new Response(JSON.stringify({ inserted: inserted?.length ?? 0, errors }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
