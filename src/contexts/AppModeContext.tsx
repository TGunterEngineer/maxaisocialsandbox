import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type UserMode = "production" | "sandbox";

interface AppModeContextValue {
  mode: UserMode;
  isSandbox: boolean;
  setMode: (mode: UserMode) => void;
  toggleMode: () => void;
}

const AppModeContext = createContext<AppModeContextValue | undefined>(undefined);

const SANDBOX_PATH_PREFIXES = ["/super-admin/demo", "/demo"];

const STORAGE_KEY = "lovable.appMode";

function readStoredMode(): UserMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "sandbox" || v === "production" ? v : null;
}

export function AppModeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pathMatchesSandbox = SANDBOX_PATH_PREFIXES.some((p) => location.pathname.startsWith(p));

  const [mode, setModeState] = useState<UserMode>(() => {
    if (pathMatchesSandbox) return "sandbox";
    return readStoredMode() ?? "production";
  });

  // Re-evaluate when route changes — sandbox path forces sandbox mode.
  useEffect(() => {
    if (pathMatchesSandbox && mode !== "sandbox") {
      setModeState("sandbox");
    }
  }, [pathMatchesSandbox, mode]);

  const setMode = useCallback((next: UserMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "sandbox" ? "production" : "sandbox");
  }, [mode, setMode]);

  const value = useMemo<AppModeContextValue>(
    () => ({ mode, isSandbox: mode === "sandbox", setMode, toggleMode }),
    [mode, setMode, toggleMode],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within an AppModeProvider");
  return ctx;
}
