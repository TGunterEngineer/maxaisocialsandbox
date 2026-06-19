import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// PUBLIC FIELD CONTRACT — only aggregate / explicitly public fields are returned.
// Never expose: raw_payload, external_id, location_id, organization_id,
// created_at, updated_at, sentiment, replied_at, reply_text.
// When changing selects or response mapping, update index_test.ts first.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("org");
    const locationId = url.searchParams.get("location");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5", 10) || 5, 20);
    const minRating = Math.min(Math.max(parseInt(url.searchParams.get("min") ?? "4", 10) || 4, 1), 5);

    if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) {
      return json({ error: "Invalid org" }, 400);
    }
    if (locationId && !/^[0-9a-f-]{36}$/i.test(locationId)) {
      return json({ error: "Invalid location" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: ok } = await supabase.rpc("check_rate_limit", {
      _bucket: "widget_reviews",
      _identifier: `${ip}:${orgId}`,
      _max_attempts: 120,
      _window_minutes: 1,
    });
    if (ok === false) return json({ error: "Rate limit" }, 429);

    // Org for branding
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url, primary_color")
      .eq("id", orgId)
      .maybeSingle();
    if (!org) return json({ error: "Not found" }, 404);

    let location: { name: string; google_review_url: string | null } | null = null;
    if (locationId) {
      const { data: loc } = await supabase
        .from("locations")
        .select("name, google_review_url, organization_id")
        .eq("id", locationId)
        .maybeSingle();
      if (!loc || loc.organization_id !== orgId) return json({ error: "Not found" }, 404);
      location = { name: loc.name, google_review_url: safeHttpUrl(loc.google_review_url) };
    }

    // Aggregate average from ALL reviews (not just shown)
    let aggQuery = supabase
      .from("reviews")
      .select("rating", { count: "exact" })
      .eq("organization_id", orgId)
      .not("rating", "is", null);
    if (locationId) aggQuery = aggQuery.eq("location_id", locationId);
    const { data: allRatings } = await aggQuery;
    const ratings = (allRatings ?? []).map((r) => r.rating as number).filter(Boolean);
    const total = ratings.length;
    const avg = total ? ratings.reduce((a, b) => a + b, 0) / total : 0;

    // Recent featured reviews
    let revQuery = supabase
      .from("reviews")
      .select("id, author_name, author_avatar_url, rating, text, source, review_date, review_url")
      .eq("organization_id", orgId)
      .gte("rating", minRating)
      .order("review_date", { ascending: false })
      .limit(limit);
    if (locationId) revQuery = revQuery.eq("location_id", locationId);
    const { data: reviews } = await revQuery;

    return json(
      {
        organization: { name: org.name, logo_url: org.logo_url, primary_color: org.primary_color },
        location,
        stats: { average: Math.round(avg * 10) / 10, total },
        reviews: (reviews ?? []).map((r) => ({
          id: r.id,
          author: r.author_name,
          avatar: r.author_avatar_url,
          rating: r.rating,
          text: r.text,
          source: r.source,
          date: r.review_date,
          url: safeHttpUrl(r.review_url),
        })),
      },
      200,
      { "Cache-Control": "public, max-age=300, s-maxage=300" },
    );
  } catch (e) {
    console.error("widget-reviews error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});

function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u || typeof u !== "string") return null;
  return /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}
