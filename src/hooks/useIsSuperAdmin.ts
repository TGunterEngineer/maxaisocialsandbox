/**
 * Demo mode: all gating is disabled — every user is treated as a super admin
 * so subscription paywalls and per-tier feature gates are bypassed.
 */
export function useIsSuperAdmin() {
  return {
    isSuperAdmin: true,
    isLoading: false,
  };
}
