// supabase/functions/payments-webhook/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createStripeClient,
  priceIdToPlanTier,
  type StripeEnv,
  verifyWebhook,
} from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

function extractSubscriptionFields(subscription: any) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  return { priceId, productId, periodEnd };
}

const VALID_PLAN_TIERS = new Set(["essential", "starter", "pro", "premium", "founder"]);

async function logWarning(
  source: string,
  message: string,
  context: Record<string, unknown>,
  organizationId: string | null = null,
  level: "warning" | "error" = "warning",
) {
  if (level === "error") console.error(`[${source}] ${message}`, context);
  else console.warn(`[${source}] ${message}`, context);
  const { error } = await getSupabase().from("error_logs").insert({
    source,
    level,
    message,
    context,
    organization_id: organizationId,
  });
  if (error) console.error("Failed to write error_logs entry:", error);
}

/**
 * Detect Stripe tax calculation failures from either a thrown error or an
 * embedded `last_finalization_error` / `automatic_tax` failure on the event
 * payload. Returns a normalized description, or null if no tax error found.
 */
function detectTaxFailure(
  err: unknown,
  eventObject: Record<string, unknown> | undefined,
): { message: string; details: Record<string, unknown> } | null {
  // Thrown Stripe error path
  if (err && typeof err === "object") {
    const e = err as { code?: string; type?: string; message?: string; raw?: { code?: string } };
    const code = e.code ?? e.raw?.code ?? "";
    const msg = (e.message ?? "").toLowerCase();
    if (code.includes("tax") || msg.includes("tax")) {
      return {
        message: `Stripe tax error: ${e.message ?? code ?? "unknown"}`,
        details: { code, type: e.type, raw_message: e.message },
      };
    }
  }
  // Embedded failure path: invoice.last_finalization_error or
  // automatic_tax.status === 'failed' on invoices / sessions.
  if (eventObject && typeof eventObject === "object") {
    const obj = eventObject as {
      last_finalization_error?: { code?: string; message?: string } | null;
      automatic_tax?: { status?: string } | null;
    };
    const finErr = obj.last_finalization_error;
    if (finErr && (finErr.code ?? "").includes("tax")) {
      return {
        message: `Stripe invoice finalization failed (tax): ${finErr.message ?? finErr.code}`,
        details: { code: finErr.code, raw_message: finErr.message },
      };
    }
    if (obj.automatic_tax && obj.automatic_tax.status === "failed") {
      return {
        message: "Stripe automatic_tax calculation failed for this object",
        details: { automatic_tax_status: obj.automatic_tax.status },
      };
    }
  }
  return null;
}

/**
 * Resolve plan tier from the Stripe Product's `metadata.plan_tier`.
 * Falls back to null when missing/empty so the caller can apply restricted state.
 */
async function resolvePlanTierFromProduct(
  productId: string | null | undefined,
  env: StripeEnv,
): Promise<string | null> {
  if (!productId) return null;
  try {
    const stripe = createStripeClient(env);
    const product = await stripe.products.retrieve(productId);
    const tier = (product.metadata?.plan_tier ?? "").trim().toLowerCase();
    if (!tier) return null;
    return tier;
  } catch (e) {
    console.error("Failed to retrieve Stripe product:", productId, e);
    return null;
  }
}

/**
 * Sync the organizations table with the latest plan_tier + plan_status from Stripe.
 * Looks up the org by stripe_customer_id (via the subscriptions row).
 */
async function syncOrganizationPlan(args: {
  organizationId: string | null;
  stripeCustomerId: string | null;
  planTier: string | null;
  planStatus: string;
  env: StripeEnv;
  productId?: string | null;
  subscriptionId?: string | null;
}) {
  let orgId = args.organizationId;

  // If we don't have orgId from metadata, look it up from subscriptions by customer id.
  if (!orgId && args.stripeCustomerId) {
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("organization_id")
      .eq("stripe_customer_id", args.stripeCustomerId)
      .eq("environment", args.env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    orgId = (data?.organization_id as string | undefined) ?? null;
  }

  if (!orgId) {
    await logWarning(
      "payments-webhook",
      "Could not resolve organization for plan sync",
      {
        stripe_customer_id: args.stripeCustomerId,
        subscription_id: args.subscriptionId,
        env: args.env,
      },
    );
    return;
  }

  let finalTier: string | null = args.planTier;
  let finalStatus = args.planStatus;

  // Fallback safety: missing/invalid metadata.plan_tier → restrict the org.
  if (!finalTier || !VALID_PLAN_TIERS.has(finalTier)) {
    await logWarning(
      "payments-webhook",
      "Stripe product metadata.plan_tier missing or invalid; defaulting org to restricted",
      {
        product_id: args.productId,
        subscription_id: args.subscriptionId,
        received_tier: args.planTier,
        env: args.env,
      },
      orgId,
    );
    finalTier = null;
    finalStatus = "restricted";
  }

  const { error } = await getSupabase()
    .from("organizations")
    .update({
      plan_tier: finalTier,
      plan_status: finalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) console.error("Failed to update organizations plan:", error);
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  const organizationId = subscription.metadata?.organizationId;
  if (!userId || !organizationId) {
    console.error("Missing userId or organizationId in subscription metadata");
    return;
  }
  const { priceId, productId, periodEnd } = extractSubscriptionFields(subscription);

  // Metadata-driven tier resolution from the Stripe Product.
  const tierFromMetadata = await resolvePlanTierFromProduct(productId, env);
  const planTier = tierFromMetadata ?? priceIdToPlanTier(priceId);

  // For founder plan, atomically claim a slot (1..10). Returns null if all taken.
  let founderSlotNumber: number | null = null;
  if (planTier === "founder") {
    const { data, error } = await getSupabase().rpc("claim_founder_slot", {
      _org_id: organizationId,
      _user_id: userId,
    });
    if (error) {
      console.error("claim_founder_slot failed:", error);
    } else {
      founderSlotNumber = (data as number | null) ?? null;
    }
  }

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      plan_tier: planTier,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      founder_slot_number: founderSlotNumber,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  await syncOrganizationPlan({
    organizationId,
    stripeCustomerId: subscription.customer,
    planTier: tierFromMetadata,
    planStatus: subscription.status,
    env,
    productId,
    subscriptionId: subscription.id,
  });
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // SMS credit top-ups: one-time payments tagged via metadata.type. Apply credits
  // idempotently keyed on the Stripe session id so retries can't double-credit.
  if (session?.metadata?.type === "sms_topup") {
    const orgId = session.metadata.organizationId;
    const credits = parseInt(session.metadata.credits ?? "0", 10);
    if (orgId && credits > 0 && session.payment_status === "paid") {
      const { error } = await getSupabase().rpc("credit_sms_topup", {
        _org_id: orgId,
        _credits: credits,
        _stripe_session_id: session.id,
        _amount_cents: session.amount_total ?? null,
        _currency: session.currency ?? null,
        _environment: env,
        _created_by: session.metadata.userId ?? null,
      });
      if (error) console.error("credit_sms_topup failed:", error);
    }
    return;
  }

  // Idempotent confirmation that complements customer.subscription.created.
  const subId = session.subscription;
  if (!subId) return;
  await getSupabase()
    .from("subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env)
    .in("status", ["incomplete", "trialing"]);
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const { priceId, productId, periodEnd } = extractSubscriptionFields(subscription);

  const tierFromMetadata = await resolvePlanTierFromProduct(productId, env);
  const planTier = tierFromMetadata ?? priceIdToPlanTier(priceId);

  await getSupabase()
    .from("subscriptions")
    .update({
      status: subscription.status,
      product_id: productId,
      price_id: priceId,
      plan_tier: planTier,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  // Map Stripe subscription status → org-level plan_status.
  // active/trialing → active; past_due/unpaid → past_due; canceled/incomplete_expired → canceled.
  let planStatus = subscription.status as string;
  if (planStatus === "unpaid") planStatus = "past_due";
  if (planStatus === "incomplete_expired") planStatus = "canceled";

  await syncOrganizationPlan({
    organizationId: subscription.metadata?.organizationId ?? null,
    stripeCustomerId: subscription.customer,
    planTier: tierFromMetadata,
    planStatus,
    env,
    productId,
    subscriptionId: subscription.id,
  });
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  // Revoke org access immediately when the subscription is fully deleted.
  const orgId = subscription.metadata?.organizationId ?? null;
  let resolvedOrgId = orgId;
  if (!resolvedOrgId && subscription.customer) {
    const { data } = await getSupabase()
      .from("subscriptions")
      .select("organization_id")
      .eq("stripe_customer_id", subscription.customer)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    resolvedOrgId = (data?.organization_id as string | undefined) ?? null;
  }
  if (resolvedOrgId) {
    const { error } = await getSupabase()
      .from("organizations")
      .update({
        plan_tier: null,
        plan_status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", resolvedOrgId);
    if (error) console.error("Failed to mark org canceled:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook with invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  // Verify signature first — a verification failure is the one case where
  // we want Stripe to retry (returns 400). Everything past this point
  // returns 200 and logs to error_logs so processing never gets dropped
  // on a single bad event (e.g. tax calculation failure on one invoice).
  let event: { type: string; data: { object: any } };
  try {
    event = await verifyWebhook(req, env);
  } catch (e) {
    console.error("Webhook verification failed:", e);
    return new Response("Webhook error", { status: 400 });
  }

  const dispatch = async () => {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object, env);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
  };

  try {
    await dispatch();
  } catch (e) {
    const obj = event.data?.object as Record<string, unknown> | undefined;
    const orgId =
      (obj?.metadata as { organizationId?: string } | undefined)?.organizationId ?? null;
    const taxErr = detectTaxFailure(e, obj);
    if (taxErr) {
      await logWarning(
        "payments-webhook",
        taxErr.message,
        {
          event_type: event.type,
          event_id: (event as { id?: string }).id ?? null,
          stripe_object_id: (obj as { id?: string } | undefined)?.id ?? null,
          env,
          ...taxErr.details,
        },
        orgId,
        "error",
      );
    } else {
      await logWarning(
        "payments-webhook",
        `Handler failed for ${event.type}: ${e instanceof Error ? e.message : String(e)}`,
        {
          event_type: event.type,
          event_id: (event as { id?: string }).id ?? null,
          stripe_object_id: (obj as { id?: string } | undefined)?.id ?? null,
          env,
          stack: e instanceof Error ? e.stack ?? null : null,
        },
        orgId,
        "error",
      );
    }
    // Intentionally return 200 — the event has been recorded; Stripe will
    // not retry a known-bad payload (e.g. tax misconfiguration on one
    // product) and bury subsequent webhooks behind it.
  }

  // Secondary sweep: some events succeed but still embed a tax failure on
  // the object itself (e.g. invoice.automatic_tax.status === 'failed').
  const embeddedTax = detectTaxFailure(undefined, event.data?.object as Record<string, unknown>);
  if (embeddedTax) {
    const obj = event.data?.object as Record<string, unknown> | undefined;
    const orgId =
      (obj?.metadata as { organizationId?: string } | undefined)?.organizationId ?? null;
    await logWarning(
      "payments-webhook",
      embeddedTax.message,
      {
        event_type: event.type,
        stripe_object_id: (obj as { id?: string } | undefined)?.id ?? null,
        env,
        ...embeddedTax.details,
      },
      orgId,
      "warning",
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
