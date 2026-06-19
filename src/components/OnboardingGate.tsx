import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { isOnboardingComplete, markOnboardingComplete } from "@/pages/Onboarding";

/**
 * Redirects first-time orgs (no locations + onboarding flag not set)
 * to /onboarding. Sits inside Paid routes, after auth + subscription gates.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { organizationId } = useOrganization();
  const location = useLocation();
  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) return;
    if (isOnboardingComplete(organizationId)) {
      setNeedsOnboarding(false);
      setChecked(true);
      return;
    }
    (async () => {
      const { count } = await supabase
        .from("locations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (cancelled) return;
      if ((count ?? 0) > 0) {
        // Already has locations — treat as onboarded
        markOnboardingComplete(organizationId);
        setNeedsOnboarding(false);
      } else {
        setNeedsOnboarding(true);
      }
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (!organizationId || !checked) return <>{children}</>;
  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
