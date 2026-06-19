import { ExternalLink, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppMode } from "@/contexts/AppModeContext";

// Update this to the public repository URL for the portfolio.
const GITHUB_REPO_URL = "https://github.com/maximumai/maxai-social";

export function SandboxBanner() {
  const { isSandbox } = useAppMode();
  if (!isSandbox) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/15 to-primary/10 backdrop-blur supports-[backdrop-filter]:bg-primary/10"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-medium">Portfolio Sandbox Mode Active</span>
          <span className="hidden text-muted-foreground sm:inline">— System Architecture Simulated</span>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7">
          <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
            View source <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}
