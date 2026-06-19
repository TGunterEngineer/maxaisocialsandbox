import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUsage } from "@/hooks/useUsage";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { planIncludes, minTierFor, UPGRADE_PATH, type FeatureKey } from "@/lib/planFeatures";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
}

/**
 * Route-level guard. Allows the page through only if the org's effective plan
 * tier (active paid subscription) unlocks the feature. Otherwise redirects to
 * /pricing with context so the pricing page can show an upsell.
 *
 * Super admins bypass all feature gates.
 *
 * Wrap this *inside* SubscriptionGate (which verifies an active subscription).
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { usage, isLoading } = useUsage();
  const { isSuperAdmin, isLoading: isAdminLoading } = useIsSuperAdmin();
  const location = useLocation();

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Super admin: full access to every feature
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // usage.plan_tier reflects the org's active subscription tier from the server RPC.
  if (!planIncludes(usage?.plan_tier ?? null, feature, usage?.has_elite_features ?? false)) {
    return (
      <Navigate
        to={UPGRADE_PATH}
        replace
        state={{
          from: location.pathname,
          gatedFeature: feature,
          requiredTier: minTierFor(feature),
        }}
      />
    );
  }

  return <>{children}</>;
}
