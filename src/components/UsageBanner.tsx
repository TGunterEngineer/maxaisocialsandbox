import { useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useUsage, type ResourceKey } from "@/hooks/useUsage";
import { useOrganization } from "@/hooks/useOrganization";
import { SmsTopupDialog } from "@/components/SmsTopupDialog";

interface Props {
  resource: ResourceKey;
  label: string;
  /** Show only when nearing/at limit (>= 80%). */
  thresholdOnly?: boolean;
  className?: string;
}

/** Inline banner showing usage + an upgrade CTA when nearing the cap. */
export function UsageBanner({ resource, label, thresholdOnly = true, className }: Props) {
  const { usage, percentUsed } = useUsage();
  const { organizationId, canManageTeam } = useOrganization();
  const [topupOpen, setTopupOpen] = useState(false);

  const r = usage?.[resource];
  if (!r || r.limit === null) return null; // unlimited (founder) — hide
  const pct = percentUsed(resource);
  if (thresholdOnly && pct < 80) return null;

  const atLimit = r.used >= r.limit;
  const tone = atLimit
    ? "border-destructive/40 bg-destructive/5"
    : "border-amber-500/40 bg-amber-500/5";

  // Show the SMS top-up CTA at >=80% usage of the monthly SMS allotment to
  // owners/admins who can pay. Sits next to the standard upgrade CTA.
  const showTopup = resource === "sms_month" && canManageTeam && !!organizationId;

  return (
    <Card className={`${tone} ${className ?? ""}`}>
      <CardContent className="py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {label}: {r.used.toLocaleString()} / {r.limit.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              {atLimit ? "Limit reached" : `${100 - pct}% remaining`}
            </span>
          </div>
          <Progress value={pct} />
        </div>
        <div className="flex gap-2">
          {showTopup && (
            <Button size="sm" variant={atLimit ? "default" : "outline"} onClick={() => setTopupOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Buy 500 credits
            </Button>
          )}
          <Button asChild size="sm" variant={atLimit && !showTopup ? "default" : "outline"}>
            <Link to="/pricing">
              <Sparkles className="h-4 w-4 mr-1.5" /> Upgrade
            </Link>
          </Button>
        </div>
      </CardContent>
      {showTopup && organizationId && (
        <SmsTopupDialog open={topupOpen} onOpenChange={setTopupOpen} organizationId={organizationId} />
      )}
    </Card>
  );
}
