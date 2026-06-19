import { useQuery } from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export type PlanTier = "founder" | "premium" | "starter" | "pro" | null;

export interface SubscriptionInfo {
  id: string;
  status: string;
  plan_tier: PlanTier;
  price_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  founder_slot_number: number | null;
}

export function useSubscription() {
  const { organizationId } = useOrganization();
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useIsSuperAdmin();
  const subscriptionChannelId = useId();

  const query = useQuery({
    queryKey: ["subscription", organizationId, isSuperAdmin],
    queryFn: async (): Promise<SubscriptionInfo | null> => {
      if (!organizationId) return null;
      if (isSuperAdmin) {
        return {
          id: "super-admin",
          status: "active",
          plan_tier: "founder",
          price_id: null,
          cancel_at_period_end: false,
          current_period_end: null,
          founder_slot_number: null,
        };
      }
      const { data, error } = await supabase.rpc("get_org_subscription_summary", {
        _org_id: organizationId,
      });
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      const row = rows[0] ?? null;
      if (!row) return null;
      return {
        id: row.id,
        status: row.status,
        plan_tier: row.plan_tier,
        price_id: row.price_id,
        cancel_at_period_end: row.cancel_at_period_end,
        current_period_end: row.current_period_end,
        founder_slot_number: row.founder_slot_number,
      };
    },
    enabled: !!organizationId && !isSuperAdminLoading,
  });

  useEffect(() => {
    if (!organizationId) return;
    const channelName = `subscriptions:${organizationId}:${subscriptionChannelId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `organization_id=eq.${organizationId}` },
        () => query.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, query, subscriptionChannelId]);

  const sub = query.data;
  const isActive =
    !!sub &&
    (sub.status === "active" || sub.status === "trialing") &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

  return {
    subscription: sub ?? null,
    isActive,
    planTier: (sub?.plan_tier as PlanTier) ?? null,
    isLoading: isSuperAdminLoading || query.isLoading,
    refetch: query.refetch,
  };
}

export function useFounderSlotsRemaining() {
  return useQuery({
    queryKey: ["founder_slots_remaining"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_founder_slots_remaining");
      if (error) throw error;
      return (data as number) ?? 0;
    },
    refetchInterval: 30000,
  });
}
