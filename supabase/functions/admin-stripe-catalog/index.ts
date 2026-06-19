import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listCatalog(env: StripeEnv) {
  const stripe = createStripeClient(env);
  const products = await stripe.products.list({ limit: 100, active: true });
  const prices = await stripe.prices.list({ limit: 100, active: true });

  return products.data.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    plan_tier: (p.metadata?.plan_tier as string | undefined) ?? null,
    // Surface tax_code so admins can see which products still need
    // setup-product-tax-codes to run (null = no Stripe tax calculation).
    tax_code: (p as { tax_code?: string | null }).tax_code ?? null,
    metadata: p.metadata ?? {},
    prices: prices.data
      .filter((pr) => (typeof pr.product === "string" ? pr.product : pr.product?.id) === p.id)
      .map((pr) => ({
        id: pr.id,
        lookup_key: pr.lookup_key,
        nickname: pr.nickname,
        unit_amount: pr.unit_amount,
        currency: pr.currency,
        recurring: pr.recurring ? { interval: pr.recurring.interval, interval_count: pr.recurring.interval_count } : null,
      })),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await admin.auth.getUser(authHeader);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin privileges required" }, 403);

    const envs: StripeEnv[] = [];
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    if (Deno.env.get("STRIPE_SANDBOX_API_KEY")) envs.push("sandbox");
    if (Deno.env.get("STRIPE_LIVE_API_KEY")) envs.push("live");

    for (const env of envs) {
      try {
        results[env] = await listCatalog(env);
      } catch (e) {
        errors[env] = e instanceof Error ? e.message : String(e);
      }
    }

    return json({ generatedAt: new Date().toISOString(), catalog: results, errors });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
