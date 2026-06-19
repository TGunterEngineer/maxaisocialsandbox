import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Zap, AlertCircle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

const TIER_CONFIG = {
  founder: { label: "Founder", icon: Crown, className: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent hover:opacity-90" },
  premium: { label: "Premium", icon: Sparkles, className: "bg-gradient-to-r from-primary to-accent text-primary-foreground border-transparent hover:opacity-90" },
  pro: { label: "Growth", icon: Sparkles, className: "bg-gradient-to-r from-primary to-accent text-primary-foreground border-transparent hover:opacity-90" },
  starter: { label: "Essential", icon: Zap, className: "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80" },
} as const;

export function SubscriptionBadge({ collapsed = false }: { collapsed?: boolean }) {
  const { subscription, isActive, planTier, isLoading } = useSubscription();

  if (isLoading) return null;

  if (!subscription || !planTier) {
    if (collapsed) {
      return (
        <div
          className="mx-auto h-2 w-2 rounded-full bg-muted-foreground/40"
          title="No active plan"
          aria-label="No active plan"
        />
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-[10px] font-medium">
        <AlertCircle className="h-3 w-3" />
        No Plan
      </Badge>
    );
  }

  const config = TIER_CONFIG[planTier];
  if (!config) return null;
  const Icon = config.icon;

  if (collapsed) {
    return (
      <div
        className={cn(
          "mx-auto h-2 w-2 rounded-full",
          isActive ? "bg-emerald-500 shadow-[0_0_6px_hsl(var(--primary)/0.6)]" : "bg-destructive",
        )}
        title={`${config.label} — ${isActive ? "Active" : "Inactive"}`}
        aria-label={`${config.label} plan ${isActive ? "active" : "inactive"}`}
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={cn("gap-1 text-[10px] font-semibold uppercase tracking-wide", config.className)}>
        <Icon className="h-3 w-3" />
        {config.label}
        {subscription.founder_slot_number ? ` #${subscription.founder_slot_number}` : ""}
      </Badge>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-emerald-500 shadow-[0_0_6px_hsl(142_76%_45%/0.7)]" : "bg-destructive",
        )}
        title={isActive ? "Active" : "Inactive"}
        aria-label={isActive ? "Active" : "Inactive"}
      />
    </div>
  );
}
