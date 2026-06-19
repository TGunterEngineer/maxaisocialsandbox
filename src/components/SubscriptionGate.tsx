import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useOrganization } from "@/hooks/useOrganization";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

/**
 * Wraps protected routes that require an active paid subscription.
 * Super admins bypass the paywall entirely.
 * Routes excluded from the paywall: /pricing, /billing/return, /auth, /invite/*, /r/*, /unsubscribe, /super-admin
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const { isActive, isLoading } = useSubscription();
  const { isSuperAdmin, isLoading: isAdminLoading } = useIsSuperAdmin();
  const location = useLocation();

  if (!user || !organizationId || isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isActive && !isSuperAdmin) {
    // Non-subscribers (including brand-new signups) only have access to the demo.
    return <Navigate to="/demo" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
