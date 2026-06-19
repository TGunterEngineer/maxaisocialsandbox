import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PlanTier = "founder" | "starter" | "pro" | null;

const PLAN_REVENUE: Record<Exclude<PlanTier, null>, number> = {
  founder: 49,
  starter: 99,
  pro: 199,
};

const PLATFORM_BASE_COST: Record<Exclude<PlanTier, null>, number> = {
  founder: 18,
  starter: 8,
  pro: 18,
};

const SMS_COST_PER_MESSAGE = 0.015;
const REVIEW_SYNC_COST_PER_LOCATION_SYNC = 0.025;
const WEBHOOK_DELIVERY_COST = 0.0005;
const PAYMENT_FIXED_FEE = 0.3;
const PAYMENT_PERCENT_FEE = 0.029;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getMonthlyRevenue(planTier: PlanTier, status: string | null) {
  if (!planTier || !status || !["active", "trialing", "past_due"].includes(status)) return 0;
  return PLAN_REVENUE[planTier] ?? 0;
}

function getPlatformBaseCost(planTier: PlanTier) {
  if (!planTier) return 0;
  return PLATFORM_BASE_COST[planTier] ?? 0;
}

function getMonthlyReviewSyncsPerLocation(planTier: PlanTier) {
  switch (planTier) {
    case "starter":
      return 4.3;
    case "pro":
    case "founder":
      return 30;
    default:
      return 0;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Backend is not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await admin.auth.getUser(authHeader);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const userId = userData.user.id;
    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError) return json({ error: roleError.message }, 500);
    if (!isAdmin) return json({ error: "Admin privileges required" }, 403);

    const { data: organizations, error: orgError } = await admin
      .from("organizations")
      .select("id, name, primary_color, created_at")
      .order("created_at", { ascending: false });

    if (orgError) return json({ error: orgError.message }, 500);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const orgRows = await Promise.all(
      (organizations ?? []).map(async (org) => {
        const [
          subscriptionResult,
          memberCountResult,
          locationCountResult,
          syncedLocationCountResult,
          contactCountResult,
          smsCountResult,
          reviewCountResult,
          webhookCountResult,
        ] = await Promise.all([
          admin
            .from("subscriptions")
            .select("plan_tier, status, environment, current_period_end")
            .eq("organization_id", org.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin.from("user_organizations").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          admin.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          admin
            .from("locations")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .not("google_review_url", "is", null),
          admin.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          admin
            .from("sms_send_log")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .eq("status", "sent")
            .gte("created_at", monthStart.toISOString()),
          admin.from("reviews").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
          admin
            .from("webhook_deliveries")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .gte("created_at", thirtyDaysAgo),
        ]);

        const subscription = subscriptionResult.data;
        const planTier = (subscription?.plan_tier as PlanTier) ?? null;
        const subscriptionStatus = subscription?.status ?? null;
        const revenueMonthly = getMonthlyRevenue(planTier, subscriptionStatus);
        const paymentFeesMonthly = revenueMonthly > 0
          ? roundCurrency(revenueMonthly * PAYMENT_PERCENT_FEE + PAYMENT_FIXED_FEE)
          : 0;

        const members = memberCountResult.count ?? 0;
        const locations = locationCountResult.count ?? 0;
        const syncedLocations = syncedLocationCountResult.count ?? 0;
        const contacts = contactCountResult.count ?? 0;
        const smsThisMonth = smsCountResult.count ?? 0;
        const reviewsTotal = reviewCountResult.count ?? 0;
        const webhookDeliveries30d = webhookCountResult.count ?? 0;

        const platformBaseCost = roundCurrency(getPlatformBaseCost(planTier));
        const smsCostMonthly = roundCurrency(smsThisMonth * SMS_COST_PER_MESSAGE);
        const estimatedReviewSyncRunsMonthly = roundCurrency(
          syncedLocations * getMonthlyReviewSyncsPerLocation(planTier),
        );
        const reviewSyncCostMonthly = roundCurrency(
          estimatedReviewSyncRunsMonthly * REVIEW_SYNC_COST_PER_LOCATION_SYNC,
        );
        const webhookCostMonthly = roundCurrency(webhookDeliveries30d * WEBHOOK_DELIVERY_COST);
        const estimatedCostMonthly = roundCurrency(
          platformBaseCost + smsCostMonthly + reviewSyncCostMonthly + webhookCostMonthly + paymentFeesMonthly,
        );

        return {
          id: org.id,
          name: org.name,
          primaryColor: org.primary_color,
          createdAt: org.created_at,
          planTier,
          subscriptionStatus,
          subscriptionEnvironment: subscription?.environment ?? null,
          revenueMonthly: roundCurrency(revenueMonthly),
          estimatedCostMonthly,
          grossMarginMonthly: roundCurrency(revenueMonthly - estimatedCostMonthly),
          usage: {
            members,
            locations,
            syncedLocations,
            contacts,
            smsThisMonth,
            reviewsTotal,
            webhookDeliveries30d,
          },
          costBreakdown: {
            platformBaseCost,
            smsCostMonthly,
            reviewSyncCostMonthly,
            webhookCostMonthly,
            paymentFeesMonthly,
            estimatedReviewSyncRunsMonthly,
          },
        };
      }),
    );

    return json({
      generatedAt: new Date().toISOString(),
      assumptions: {
        pricing: PLAN_REVENUE,
        platformBaseCost: PLATFORM_BASE_COST,
        smsCostPerMessage: SMS_COST_PER_MESSAGE,
        reviewSyncCostPerLocationSync: REVIEW_SYNC_COST_PER_LOCATION_SYNC,
        webhookDeliveryCost: WEBHOOK_DELIVERY_COST,
        paymentProcessing: {
          fixed: PAYMENT_FIXED_FEE,
          percent: PAYMENT_PERCENT_FEE,
        },
        notes: [
          "Costs are estimates based on tracked usage and plan footprint.",
          "AI usage and transactional email spend are not currently attributed to organizations in stored logs, so they are excluded from per-org totals.",
          "Review sync spend is estimated from the number of synced locations and the plan's sync cadence.",
        ],
      },
      organizations: orgRows,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});