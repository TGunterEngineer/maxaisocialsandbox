import { useMemo } from "react";
import { useAppMode } from "@/contexts/AppModeContext";
import { createApiService, type ApiService } from "@/lib/apiService";

/**
 * Returns a sandbox-aware API service bound to the current AppMode.
 * Use this instead of calling `supabase.functions.invoke` directly so the
 * portfolio sandbox can intercept all edge function calls.
 */
export function useApiService(): ApiService {
  const { isSandbox } = useAppMode();
  return useMemo(() => createApiService({ sandbox: isSandbox }), [isSandbox]);
}
