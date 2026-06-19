import type { PlanTier } from "@/hooks/useSubscription";

/**
 * Feature keys used to gate routes and sidebar items by subscription tier.
 * Keep this in sync with the route mapping in App.tsx and the sidebar groups.
 */
export type FeatureKey =
  // Monitor
  | "inbox"
  | "analytics"
  | "review_sources"
  | "ai_insights"
  // Engage
  | "contacts"
  | "campaigns"
  | "feedback"
  // Grow (Pro+)
  | "post_creator"
  | "content_calendar"
  | "brand_voice"
  | "locations"
  // Admin (Founder only for the heaviest items)
  | "team"
  | "branding"
  | "webhooks"
  | "sms_compliance"
  | "billing";

/**
 * Path the user lands on when their tier doesn't unlock a feature.
 */
export const UPGRADE_PATH = "/pricing";

/**
 * What's included in each tier. Founder = everything (locked-in price).
 *
 * Starter  → Monitor + basic Engage
 * Pro      → + Grow (content marketing) + Locations + Team
 * Founder  → + Webhooks + multi-location + everything else
 */
const STARTER: FeatureKey[] = [
  "inbox",
  "analytics",
  "review_sources",
  "ai_insights",
  "contacts",
  "campaigns",
  "feedback",
  "sms_compliance",
  "billing",
];

const PRO: FeatureKey[] = [
  ...STARTER,
  "post_creator",
  "content_calendar",
  "brand_voice",
  "locations",
  "team",
  "branding",
];

// Premium = Pro feature surface + webhooks (matches Founder for outbound integrations).
const PREMIUM: FeatureKey[] = [...PRO, "webhooks"];

const FOUNDER: FeatureKey[] = [...PRO, "webhooks"];

/**
 * Features that still require the elite tier (Founder, or Premium with the
 * is_premium_plus add-on flag). Webhooks were moved out — they are now
 * available on both Premium and Founder. Keep in sync with org_has_elite_features() in DB.
 */
export const ELITE_FEATURES: FeatureKey[] = [];

const PLAN_FEATURES: Record<NonNullable<PlanTier>, FeatureKey[]> = {
  starter: STARTER,
  pro: PRO,
  premium: PREMIUM,
  founder: FOUNDER,
};

/**
 * Returns true if the given plan tier unlocks the feature.
 * For ELITE_FEATURES, the caller must additionally pass hasEliteFeatures.
 * Null/undefined tier = no plan = no features.
 */
export function planIncludes(
  tier: PlanTier,
  feature: FeatureKey,
  hasEliteFeatures: boolean = false,
): boolean {
  if (!tier) return false;
  if (ELITE_FEATURES.includes(feature)) {
    if (tier === "founder") return true;
    if (tier === "premium") return hasEliteFeatures;
    return false;
  }
  return PLAN_FEATURES[tier]?.includes(feature) ?? false;
}

/**
 * Lowest tier required to unlock a feature — used in upsell copy.
 */
export function minTierFor(feature: FeatureKey): "starter" | "pro" | "premium" | "founder" {
  if (ELITE_FEATURES.includes(feature)) return "founder";
  if (STARTER.includes(feature)) return "starter";
  if (PRO.includes(feature)) return "pro";
  if (PREMIUM.includes(feature)) return "premium";
  return "founder";
}
