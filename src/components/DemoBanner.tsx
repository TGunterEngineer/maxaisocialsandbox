import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "demo-banner-dismissed";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const [resetting, setResetting] = useState(false);

  if (dismissed) return null;

  const reset = async () => {
    setResetting(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demo-bootstrap?reseed=1`;
      const res = await fetch(url, {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
      });
      if (!res.ok) throw new Error("reseed failed");
      toast.success("Demo data refreshed — reloading…");
      setTimeout(() => window.location.reload(), 700);
    } catch {
      toast.error("Could not reset demo data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300 backdrop-blur">
      <Sparkles className="h-3.5 w-3.5" />
      <span className="font-medium">
        Demo workspace — data is shared across all visitors and may change as others interact.
      </span>
      <button
        onClick={reset}
        disabled={resetting}
        className="rounded border border-amber-500/40 px-2 py-0.5 font-medium hover:bg-amber-500/20 disabled:opacity-50"
      >
        {resetting ? "Resetting…" : "Reset demo data"}
      </button>
      <button
        onClick={() => {
          try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
          setDismissed(true);
        }}
        className="ml-1 rounded p-0.5 hover:bg-amber-500/20"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
