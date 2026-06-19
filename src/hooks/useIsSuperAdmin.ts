import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true if the currently authenticated user is the locked-down
 * super admin (email match + super_admin role enforced server-side by
 * has_role). When true, the app bypasses subscription paywalls and
 * per-tier feature gates.
 */
export function useIsSuperAdmin() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["is_super_admin", user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("is_super_admin");
      if (error) {
        console.warn("is_super_admin check failed", error);
        return false;
      }
      return Boolean(data);
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return {
    isSuperAdmin: Boolean(query.data),
    isLoading: query.isLoading,
  };
}
