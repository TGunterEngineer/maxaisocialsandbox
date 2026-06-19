// One-time checkout for a 500 SMS credit top-up bundle.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

// Hardcoded allow-list of every legal SMS top-up lookup_key.
// Bundle size is bound to the lookup key so the client cannot request an
// arbitrary credit count.
const TOPUP_BUNDLES: Record<string, { credits: number }> = {
  sms_topup_500: { credits: 500 },
};
const ALLOWED_TOPUP_LOOKUP_KEYS = new Set(Object.keys(TOPUP_BUNDLES));

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { organizationId, returnUrl, environment, bundle } = body as {
      organizationId: string;
      returnUrl: string;
      environment: StripeEnv;
      bundle?: string;
    };

    const lookupKey = bundle ?? "sms_topup_500";
    if (!ALLOWED_TOPUP_LOOKUP_KEYS.has(lookupKey)) {
      return new Response(JSON.stringify({ error: "Unknown top-up bundle" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!organizationId || !returnUrl) {
      return new Response(JSON.stringify({ error: "Missing organizationId or returnUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "Invalid environment" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller can manage billing for the org (owner/admin).
    const { data: membership } = await supabase
      .from("user_organizations")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role as string)) {
      return new Response(JSON.stringify({ error: "Not authorized for this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey] });
    const price = prices.data.find((p) => p.lookup_key === lookupKey);
    if (!price) {
      return new Response(JSON.stringify({ error: "Top-up price not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const credits = TOPUP_BUNDLES[lookupKey].credits;

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: price.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer_email: user.email,
      allow_promotion_codes: false,
      managed_payments: { enabled: true },
      metadata: {
        userId: user.id,
        organizationId,
        type: "sms_topup",
        bundle: lookupKey,
        credits: String(credits),
        managed_payments: "true",
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-sms-topup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
