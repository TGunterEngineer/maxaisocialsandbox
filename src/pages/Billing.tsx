import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "@/components/ui/use-toast";

export default function Billing() {
  const { subscription, isActive, planTier, isLoading } = useSubscription();
  const { organizationId } = useOrganization();
  const [openingPortal, setOpeningPortal] = useState(false);

  const openPortal = async () => {
    if (!organizationId) return;
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          organizationId,
          returnUrl: `${window.location.origin}/billing`,
          environment: getStripeEnvironment(),
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Failed to open portal");
      window.open(data.url as string, "_blank");
    } catch (e) {
      toast({
        title: "Could not open billing portal",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <DashboardLayout title="Billing">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Manage your subscription and payment methods.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current plan</span>
              {isActive && <Badge variant="default">Active</Badge>}
              {!isActive && !isLoading && <Badge variant="outline">No active plan</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : subscription && isActive ? (
              <>
                <div className="text-sm">
                  <div>
                    <span className="text-muted-foreground">Plan: </span>
                    <span className="font-medium capitalize">{planTier ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-medium">{subscription.status}</span>
                  </div>
                  {subscription.current_period_end && (
                    <div>
                      <span className="text-muted-foreground">
                        {subscription.cancel_at_period_end ? "Access ends: " : "Renews: "}
                      </span>
                      <span className="font-medium">
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <Button onClick={openPortal} disabled={openingPortal}>
                  {openingPortal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Manage billing <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  You don't have an active subscription yet.
                </p>
                <Button asChild>
                  <Link to="/pricing">Choose a plan</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
