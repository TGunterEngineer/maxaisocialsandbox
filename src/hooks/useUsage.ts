import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export type ResourceKey = "contacts" | "locations" | "seats" | "sms_month";

export interface ResourceUsage {
  used: number;
  limit: number | null; // null = unlimited
  base_limit?: number | null;
  bonus_credits?: number;
}

export interface UsageData {
  plan_tier: "founder" | "premium" | "starter" | "pro" | null;
  has_elite_features: boolean;
  sms_bonus_credits?: number;
  contacts: ResourceUsage;
  locations: ResourceUsage;
  seats: ResourceUsage;
  sms_month: ResourceUsage;
}

export function useUsage() {
  const { organizationId } = useOrganization();
  const { isSuperAdmin } = useIsSuperAdmin();

  const query = useQuery({
    queryKey: ["org_usage", organizationId, isSuperAdmin],
    queryFn: async (): Promise<UsageData | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase.rpc("get_org_usage", {
        _org_id: organizationId,
      });
      if (error) throw error;
      const usage = data as unknown as UsageData;
      // Super admin override: present as Founder tier with unlimited everything
      if (isSuperAdmin && usage) {
        return {
          ...usage,
          plan_tier: "founder",
          has_elite_features: true,
          contacts:  { used: usage.contacts?.used  ?? 0, limit: null },
          locations: { used: usage.locations?.used ?? 0, limit: null },
          seats:     { used: usage.seats?.used     ?? 0, limit: null },
          sms_month: { used: usage.sms_month?.used ?? 0, limit: null },
        };
      }
      return usage;
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });

  const isAtLimit = (resource: ResourceKey) => {
    const r = query.data?.[resource];
    if (!r) return false;
    if (r.limit === null) return false;
    return r.used >= r.limit;
  };

  const remaining = (resource: ResourceKey): number | null => {
    const r = query.data?.[resource];
    if (!r) return null;
    if (r.limit === null) return null;
    return Math.max(0, r.limit - r.used);
  };

  const percentUsed = (resource: ResourceKey): number => {
    const r = query.data?.[resource];
    if (!r || r.limit === null || r.limit === 0) return 0;
    return Math.min(100, Math.round((r.used / r.limit) * 100));
  };

  return {
    usage: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    isAtLimit,
    remaining,
    percentUsed,
  };
}

/**
 * Parses a Postgres exception thrown by a plan-limit trigger.
 * Returns null if the error is unrelated.
 */
export function parsePlanLimitError(
  error: unknown,
): { resource: ResourceKey | "unknown"; used: number; limit: number; noSubscription: boolean } | null {
  const msg = (error as { message?: string })?.message ?? "";
  if (!msg.includes("plan_limit:")) return null;
  const parts = msg.split("plan_limit:")[1]?.split(":") ?? [];
  if (parts[0] === "no_subscription") {
    return {
      resource: (parts[1] as ResourceKey) ?? "unknown",
      used: 0,
      limit: 0,
      noSubscription: true,
    };
  }
  return {
    resource: (parts[0] as ResourceKey) ?? "unknown",
    used: parseInt(parts[1] ?? "0", 10),
    limit: parseInt(parts[2] ?? "0", 10),
    noSubscription: false,
  };
}
