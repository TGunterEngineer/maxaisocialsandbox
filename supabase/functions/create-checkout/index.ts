// supabase/functions/create-checkout/index.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

interface PlanConfig {
  subscriptionPriceId: string;
  setupPriceId: string;
}

const PLANS: Record<string, PlanConfig> = {
  founder: { subscriptionPriceId: "founder_monthly", setupPriceId: "founder_setup" },
  essential: { subscriptionPriceId: "essential_monthly", setupPriceId: "essential_setup" },
  growth: { subscriptionPriceId: "growth_monthly", setupPriceId: "growth_setup" },
  premium: { subscriptionPriceId: "premium_monthly", setupPriceId: "premium_setup" },
};

// Hardcoded allow-list of every legal subscription/setup lookup_key.
// Any price resolved from Stripe must match one of these or checkout is rejected.
// This prevents a tampered/legacy price (e.g. a $0 setup fee) from ever being
// attached to a checkout session, even if it shares a lookup_key in Stripe.
const ALLOWED_SUBSCRIPTION_LOOKUP_KEYS = new Set(
  Object.values(PLANS).map((p) => p.subscriptionPriceId),
);
const ALLOWED_SETUP_LOOKUP_KEYS = new Set(
  Object.values(PLANS).map((p) => p.setupPriceId),
);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/**
 * Validate a Stripe return URL is to an allow-listed origin. Prevents an
 * org owner/admin from crafting a checkout that redirects users to an
 * attacker-controlled URL after payment.
 */
function isAllowedReturnUrl(returnUrl: string, req: Request): boolean {
  let parsed: URL;
  try {
    parsed = new URL(returnUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const host = parsed.host.toLowerCase();
  const allowedExact = new Set<string>([
    "maxaisocial.lovable.app",
    "localhost",
    "127.0.0.1",
  ]);
  const allowedSuffixes = [".lovable.app", ".lovable.dev"];
  const appPublicUrl = Deno.env.get("APP_PUBLIC_URL");
  if (appPublicUrl) {
    try { allowedExact.add(new URL(appPublicUrl).host.toLowerCase()); } catch { /* ignore */ }
  }
  // Also accept the request's own Origin host (caller's app origin).
  const originHeader = req.headers.get("origin");
  if (originHeader) {
    try {
      const oh = new URL(originHeader).host.toLowerCase();
      if (oh === host) return true;
    } catch { /* ignore */ }
  }
  if (allowedExact.has(host)) return true;
  if (host === "localhost" || host.startsWith("localhost:")) return true;
  return allowedSuffixes.some((s) => host.endsWith(s));
}

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { plan, organizationId, returnUrl, environment } = body as {
      plan: string;
      organizationId: string;
      returnUrl: string;
      environment: StripeEnv;
    };

    if (!plan || !PLANS[plan]) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!organizationId || !returnUrl) {
      return new Response(JSON.stringify({ error: "Missing organizationId or returnUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "Invalid environment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isAllowedReturnUrl(returnUrl, req)) {
      return new Response(JSON.stringify({ error: "Invalid returnUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is owner/admin of org
    const { data: membership } = await supabase
      .from("user_organizations")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role as string)) {
      return new Response(JSON.stringify({ error: "Not authorized for this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce founder slot cap before creating a checkout session.
    if (plan === "founder") {
      const { data: remaining, error: remErr } = await supabase.rpc(
        "get_founder_slots_remaining",
      );
      if (remErr) {
        return new Response(JSON.stringify({ error: "Could not verify founder availability" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Allow re-checkout if this org already holds a slot.
      const { data: existingSlot } = await supabase
        .from("founder_slots")
        .select("slot_number")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!existingSlot && ((remaining as number) ?? 0) <= 0) {
        return new Response(JSON.stringify({ error: "All founder spots are claimed" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const stripe = createStripeClient(environment);
    const { subscriptionPriceId, setupPriceId } = PLANS[plan];

    // Defense-in-depth: confirm the resolved lookup keys are on the allow-list
    // before we ever ask Stripe to price them. This is redundant with the
    // PLANS map above but guards against future refactors that might let a
    // caller-controlled string reach this point.
    if (
      !ALLOWED_SUBSCRIPTION_LOOKUP_KEYS.has(subscriptionPriceId) ||
      !ALLOWED_SETUP_LOOKUP_KEYS.has(setupPriceId)
    ) {
      return new Response(JSON.stringify({ error: "Unauthorized price configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prices = await stripe.prices.list({
      lookup_keys: [subscriptionPriceId, setupPriceId],
    });
    const subPrice = prices.data.find((p) => p.lookup_key === subscriptionPriceId);
    const setupPrice = prices.data.find((p) => p.lookup_key === setupPriceId);
    if (!subPrice || !setupPrice) {
      return new Response(JSON.stringify({ error: "Price not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Promo codes enabled so codes created in the Stripe dashboard can be
    // redeemed at checkout (applies to both sandbox and live).
    const allowPromotionCodes = true;

    const session = await stripe.checkout.sessions.create({
      line_items: [
        { price: subPrice.id, quantity: 1 },
        { price: setupPrice.id, quantity: 1 },
      ],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer_email: user.email,
      allow_promotion_codes: allowPromotionCodes,
      // Stripe calculates and collects the correct tax at checkout based on
      // product tax_code + buyer location. Filing/remittance handled by us.
      // NOTE: incompatible with `managed_payments` — never set both.
      automatic_tax: { enabled: true },
      metadata: {
        userId: user.id,
        organizationId,
        plan,
        automatic_tax: "true",
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          organizationId,
          plan,
        },
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
