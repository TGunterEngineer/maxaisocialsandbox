import { useNavigate } from "react-router-dom";
import { Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUsage, type ResourceKey } from "@/hooks/useUsage";

const RESOURCE_LABEL: Record<ResourceKey, { singular: string; plural: string }> = {
  contacts: { singular: "contact", plural: "contacts" },
  locations: { singular: "location", plural: "locations" },
  seats: { singular: "team seat", plural: "team seats" },
  sms_month: { singular: "SMS send (this month)", plural: "SMS sends (this month)" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resource: ResourceKey;
  used?: number;
  limit?: number;
  noSubscription?: boolean;
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  resource,
  used,
  limit,
  noSubscription,
}: Props) {
  const navigate = useNavigate();
  const { usage } = useUsage();
  const label = RESOURCE_LABEL[resource]?.plural ?? resource;
  const planTier = usage?.plan_tier;

  const finalUsed = used ?? usage?.[resource]?.used ?? 0;
  const finalLimit = limit ?? usage?.[resource]?.limit ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wider font-semibold">
              {noSubscription ? "Subscription required" : "Plan limit reached"}
            </span>
          </div>
          <DialogTitle>
            {noSubscription
              ? `Subscribe to add ${label}`
              : `You've reached your ${label} limit`}
          </DialogTitle>
          <DialogDescription>
            {noSubscription
              ? "Choose a plan to start using this feature."
              : `Your ${planTier ?? "current"} plan includes ${finalLimit.toLocaleString()} ${label}. Upgrade to add more.`}
          </DialogDescription>
        </DialogHeader>

        {!noSubscription && finalLimit > 0 && (
          <div className="space-y-2 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">
                {finalUsed.toLocaleString()} / {finalLimit.toLocaleString()}
              </span>
            </div>
            <Progress value={Math.min(100, (finalUsed / finalLimit) * 100)} />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            View plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
