// AI Lab — portfolio showcase endpoint.
// Three modes, all backed by Lovable AI Gateway:
//   - "reply"          : streaming reply generator with tone control
//   - "ask-reviews"    : RAG chat over the seeded demo reviews (streaming)
//   - "insights-agent" : tool-calling agent that analyzes the demo org's reviews
//
// Designed for the public demo workspace: uses the service role to read demo
// data and does not require an auth header so anonymous visitors can try it.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "x-lovable-aig-run-id",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const DEMO_EMAIL = "demo@maximumsocial.app";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getDemoOrgId(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: u } = await admin.auth.admin.listUsers();
  const demoUser = u?.users?.find((x: any) => x.email === DEMO_EMAIL);
  if (!demoUser) return null;
  const { data } = await admin
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", demoUser.id)
    .maybeSingle();
  return (data as any)?.organization_id ?? null;
}

async function streamProxy(payload: any, apiKey: string) {
  const upstream = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, stream: true }),
  });
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return jsonResponse({ error: `Gateway ${upstream.status}: ${text}` }, upstream.status);
  }
  // Convert OpenAI-compatible SSE to a clean newline-delimited token stream.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  const out = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const token = j.choices?.[0]?.delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
        } catch { /* ignore */ }
      }
    },
  });
  return new Response(out, {
    headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "Missing LOVABLE_API_KEY" }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const mode = String(body?.mode ?? "");

    // ===== Mode 1: streaming reply generator =====
    if (mode === "reply") {
      const reviewText = String(body.reviewText ?? "").slice(0, 2000);
      const customerName = String(body.customerName ?? "Customer").slice(0, 100);
      const rating = Number(body.rating ?? 5);
      const tone = ["warm", "apologetic", "witty", "professional"].includes(body.tone) ? body.tone : "warm";
      if (!reviewText) return jsonResponse({ error: "reviewText required" }, 400);

      const toneGuide: Record<string, string> = {
        warm: "Warm, sincere, human. Use the customer's first name. 2-4 short sentences.",
        apologetic: "Acknowledge the concern, take ownership, offer a concrete next step. Don't be defensive.",
        witty: "Light playful spark, but never sarcastic. Keep it brand-safe and short.",
        professional: "Polished, on-brand, no slang. Thank them and invite continued engagement.",
      };
      const system = `You are a business owner responding to a public ${rating}-star online review. Tone: ${toneGuide[tone]}. Never apologize for things that weren't complained about. Don't promise discounts. Don't sign with a name. Output only the reply text.`;
      const user = `Customer: ${customerName}\nRating: ${rating}/5\nReview: ${reviewText}`;
      return streamProxy({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }, apiKey);
    }

    // ===== Mode 2: RAG chat over demo reviews =====
    if (mode === "ask-reviews") {
      const question = String(body.question ?? "").slice(0, 500);
      const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
      if (!question) return jsonResponse({ error: "question required" }, 400);

      const orgId = await getDemoOrgId(admin);
      if (!orgId) return jsonResponse({ error: "Demo org not ready" }, 503);

      const { data: reviews } = await admin
        .from("reviews")
        .select("id, reviewer_name, rating, content, source, created_at, location_id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(80);
      const { data: locations } = await admin
        .from("locations")
        .select("id, name")
        .eq("organization_id", orgId);
      const locMap = new Map((locations ?? []).map((l: any) => [l.id, l.name]));

      const corpus = (reviews ?? []).map((r: any, i: number) =>
        `[#${i + 1}] (${r.rating}\u2605, ${r.source}, ${locMap.get(r.location_id) ?? "Unknown"}, ${r.reviewer_name}): ${String(r.content ?? "").slice(0, 280)}`
      ).join("\n");

      const system = `You are a customer insights analyst. Answer the user's question STRICTLY based on the customer reviews below. Cite specific reviews inline like [#3] or [#12]. If the reviews don't contain enough information, say so. Be concise (under 180 words).\n\nREVIEWS:\n${corpus}`;

      return streamProxy({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          ...history.map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1000) })),
          { role: "user", content: question },
        ],
      }, apiKey);
    }

    // ===== Mode 3: insights agent (tool calling, non-streaming) =====
    if (mode === "insights-agent") {
      const goal = String(body.goal ?? "Give the operator a 90-day executive summary of customer sentiment, top complaints, top praise, and recommended actions.").slice(0, 500);
      const orgId = await getDemoOrgId(admin);
      if (!orgId) return jsonResponse({ error: "Demo org not ready" }, 503);

      const tools = [
        {
          type: "function",
          function: {
            name: "get_review_stats",
            description: "Returns total reviews, average rating, and rating distribution for the last N days.",
            parameters: { type: "object", properties: { days: { type: "number" } }, required: ["days"] },
          },
        },
        {
          type: "function",
          function: {
            name: "get_top_themes",
            description: "Returns the most common complaint and praise themes by counting keywords in review text.",
            parameters: { type: "object", properties: { days: { type: "number" }, kind: { type: "string", enum: ["complaint", "praise"] } }, required: ["days", "kind"] },
          },
        },
        {
          type: "function",
          function: {
            name: "get_sample_reviews",
            description: "Returns up to 5 sample review excerpts matching a sentiment.",
            parameters: { type: "object", properties: { sentiment: { type: "string", enum: ["positive", "negative", "mixed"] } }, required: ["sentiment"] },
          },
        },
        {
          type: "function",
          function: {
            name: "get_location_breakdown",
            description: "Returns average rating and review count grouped by location.",
            parameters: { type: "object", properties: {}, additionalProperties: false },
          },
        },
      ];

      async function execTool(name: string, args: any): Promise<any> {
        const sinceISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
        if (name === "get_review_stats") {
          const { data } = await admin
            .from("reviews").select("rating")
            .eq("organization_id", orgId)
            .gte("created_at", sinceISO(args.days ?? 90));
          const rows = data ?? [];
          const dist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
          let sum = 0;
          rows.forEach((r: any) => { dist[String(r.rating)]++; sum += r.rating; });
          return { total: rows.length, avg_rating: rows.length ? +(sum / rows.length).toFixed(2) : 0, distribution: dist };
        }
        if (name === "get_top_themes") {
          const { data } = await admin
            .from("reviews").select("content, rating")
            .eq("organization_id", orgId)
            .gte("created_at", sinceISO(args.days ?? 90));
          const themes: Record<string, string[]> = {
            "wait time": ["wait", "slow", "long"], "staff": ["staff", "team", "rude", "friendly"],
            "pricing": ["price", "expensive", "cheap", "value"], "cleanliness": ["clean", "dirty", "spotless"],
            "quality": ["quality", "fresh", "stale", "amazing"], "service": ["service", "served", "attentive"],
            "ambiance": ["atmosphere", "vibe", "music", "decor"],
          };
          const filter = args.kind === "complaint" ? (r: any) => r.rating <= 3 : (r: any) => r.rating >= 4;
          const counts: Record<string, number> = {};
          (data ?? []).filter(filter).forEach((r: any) => {
            const text = String(r.content ?? "").toLowerCase();
            for (const [name, kws] of Object.entries(themes)) {
              if (kws.some((k) => text.includes(k))) counts[name] = (counts[name] ?? 0) + 1;
            }
          });
          return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([theme, count]) => ({ theme, count }));
        }
        if (name === "get_sample_reviews") {
          let q = admin.from("reviews").select("reviewer_name, rating, content, source").eq("organization_id", orgId);
          if (args.sentiment === "positive") q = q.gte("rating", 4);
          else if (args.sentiment === "negative") q = q.lte("rating", 3);
          const { data } = await q.limit(5);
          return (data ?? []).map((r: any) => ({ ...r, content: String(r.content ?? "").slice(0, 200) }));
        }
        if (name === "get_location_breakdown") {
          const { data: locs } = await admin.from("locations").select("id, name").eq("organization_id", orgId);
          const { data: revs } = await admin.from("reviews").select("location_id, rating").eq("organization_id", orgId);
          return (locs ?? []).map((l: any) => {
            const lr = (revs ?? []).filter((r: any) => r.location_id === l.id);
            const avg = lr.length ? +(lr.reduce((s: number, r: any) => s + r.rating, 0) / lr.length).toFixed(2) : 0;
            return { location: l.name, reviews: lr.length, avg_rating: avg };
          });
        }
        return { error: "unknown tool" };
      }

      const messages: any[] = [
        { role: "system", content: "You are a senior customer-experience analyst. Use the provided tools to gather data, then write a concise executive summary in markdown with: 1) Headline metric, 2) Top complaints (with counts), 3) Top praise (with counts), 4) Per-location breakdown, 5) Three recommended actions. Cite tool-result numbers explicitly." },
        { role: "user", content: goal },
      ];

      const trace: any[] = [];
      for (let step = 0; step < 8; step++) {
        const res = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto" }),
        });
        if (!res.ok) return jsonResponse({ error: `Gateway ${res.status}: ${await res.text()}` }, res.status);
        const j = await res.json();
        const msg = j.choices?.[0]?.message;
        if (!msg) return jsonResponse({ error: "no message" }, 500);
        messages.push(msg);
        const calls = msg.tool_calls ?? [];
        if (!calls.length) {
          return jsonResponse({ summary: msg.content ?? "", trace });
        }
        for (const call of calls) {
          let args: any = {};
          try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* ignore */ }
          const result = await execTool(call.function.name, args);
          trace.push({ tool: call.function.name, args, result });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }
      return jsonResponse({ summary: "Agent exceeded step budget.", trace });
    }

    return jsonResponse({ error: "Unknown mode" }, 400);
  } catch (e) {
    console.error("ai-lab error", e);
    return jsonResponse({ error: String((e as Error).message ?? e) }, 500);
  }
});
