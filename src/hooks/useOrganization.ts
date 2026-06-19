import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useOrganization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: memberships } = useQuery({
    queryKey: ["user_organizations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select("organization_id, role, organizations(id, name, primary_color, logo_url)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selected_org_id");
    }
    return null;
  });

  useEffect(() => {
    if (memberships && memberships.length > 0) {
      const ids = memberships.map((m) => m.organization_id);
      if (!selectedOrgId || !ids.includes(selectedOrgId)) {
        const first = ids[0];
        setSelectedOrgId(first);
        localStorage.setItem("selected_org_id", first);
      }
    }
  }, [memberships, selectedOrgId]);

  const switchOrganization = useCallback(
    (orgId: string) => {
      setSelectedOrgId(orgId);
      localStorage.setItem("selected_org_id", orgId);
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const organizations = memberships?.map((m) => ({
    id: m.organization_id,
    role: m.role,
    ...(m.organizations as any),
  })) ?? [];

  const organization = organizations.find((o) => o.id === selectedOrgId) ?? null;
  const currentRole = (organization?.role as "owner" | "admin" | "member" | "viewer" | undefined) ?? null;
  const isOwner = currentRole === "owner";
  const canManageTeam = currentRole === "owner" || currentRole === "admin";
  const canWrite = currentRole === "owner" || currentRole === "admin" || currentRole === "member";

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return {
    profile,
    organization,
    organizationId: selectedOrgId,
    organizations,
    switchOrganization,
    currentRole,
    isOwner,
    canManageTeam,
    canWrite,
  };
}
