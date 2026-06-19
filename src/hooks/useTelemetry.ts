import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TelemetryLevel = "warning" | "error" | "info";

export interface LogClientErrorInput {
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  component?: string | null;
  level?: TelemetryLevel;
  context?: Record<string, unknown>;
}

/**
 * Fire-and-forget insert into public.error_logs.
 *
 * RLS allows authenticated users to insert rows with source='client' for
 * their own organization (or with no org). Anonymous users silently no-op.
 */
export async function logClientError(input: LogClientErrorInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // anonymous: skip — RLS would reject

    const selectedOrgId =
      (typeof window !== "undefined" && window.localStorage.getItem("selected_org_id")) || null;

    const context = {
      ...(input.context ?? {}),
      user_id: user.id,
      component: input.component ?? null,
      component_stack: input.componentStack ?? null,
      stack: input.stack ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
    };

    await supabase.from("error_logs").insert({
      message: (input.message ?? "Unknown error").slice(0, 2000),
      source: "client",
      level: input.level ?? "error",
      organization_id: selectedOrgId,
      context,
    });
  } catch {
    // never let telemetry crash the app
  }
}

export function useTelemetry() {
  const logError = useCallback((input: LogClientErrorInput) => logClientError(input), []);
  return { logError };
}
