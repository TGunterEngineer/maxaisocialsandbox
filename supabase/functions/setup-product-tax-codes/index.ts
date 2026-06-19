// One-time setup: assign Stripe tax codes to all products.
// SaaS / electronic services -> txcd_10103001
// Setup fees share plan products in this catalog, so product-level tax codes
// must stay eligible for the subscription line item used by Managed Payments.
// Run this once per environment (sandbox + live) after products are created.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const SUBSCRIPTION_TAX_CODE = "txcd_10103001"; // SaaS — electronically supplied services
const SETUP_TAX_CODE = SUBSCRIPTION_TAX_CODE;

const SUBSCRIPTION_LOOKUPS = ["founder_monthly", "essential_monthly", "growth_monthly", "premium_monthly"];
const SETUP_LOOKUPS = ["founder_setup", "essential_setup", "growth_setup", "premium_setup"];

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
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
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
    // Restrict to super admins only.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roles as any[] | null)?.some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const environment: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const stripe = createStripeClient(environment);

    const allLookups = [...SUBSCRIPTION_LOOKUPS, ...SETUP_LOOKUPS];
    const prices = await stripe.prices.list({ lookup_keys: allLookups, limit: 100 });

    const productUpdates = new Map<string, string>();
    for (const price of prices.data) {
      const productId = typeof price.product === "string" ? price.product : price.product?.id;
      if (!productId) continue;
      const code = SUBSCRIPTION_LOOKUPS.includes(price.lookup_key ?? "")
        ? SUBSCRIPTION_TAX_CODE
        : SETUP_TAX_CODE;
      if (productUpdates.get(productId) === SUBSCRIPTION_TAX_CODE) continue;
      productUpdates.set(productId, code);
    }

    const results: Array<{ product: string; tax_code: string; ok: boolean; error?: string }> = [];
    for (const [productId, taxCode] of productUpdates) {
      try {
        await stripe.products.update(productId, { tax_code: taxCode });
        results.push({ product: productId, tax_code: taxCode, ok: true });
      } catch (e) {
        results.push({
          product: productId,
          tax_code: taxCode,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(JSON.stringify({ environment, updated: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("setup-product-tax-codes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
