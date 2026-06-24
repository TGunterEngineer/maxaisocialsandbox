import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the currently authenticated user has the `super_admin` role.
 * Always validated server-side via the `has_role` security-definer RPC.
 * Never trust client-side flags for gating — always re-check on the server
 * (RLS policies, edge functions) as well.
 */
export function useIsSuperAdmin() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setIsSuperAdmin(false);
            setIsLoading(false);
          }
          return;
        }
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "super_admin",
        });
        if (cancelled) return;
        setIsSuperAdmin(!error && data === true);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setIsSuperAdmin(false);
          setIsLoading(false);
        }
      }
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { isSuperAdmin, isLoading };
}
