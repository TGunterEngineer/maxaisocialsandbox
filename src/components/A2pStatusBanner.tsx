import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";

type Status = "draft" | "submitted" | "approved" | "rejected" | "none";

interface Props {
  variant?: "full" | "compact";
  hideWhenApproved?: boolean;
}

export function A2pStatusBanner({ variant = "full", hideWhenApproved = false }: Props) {
  const { organizationId } = useOrganization();
  const [status, setStatus] = useState<Status | null>(null);
  const [brandSid, setBrandSid] = useState<string | null>(null);
  const [campaignSid, setCampaignSid] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("a2p_registrations")
        .select("status, twilio_brand_sid, twilio_campaign_sid")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setStatus("none");
      } else {
        setStatus((data.status as Status) ?? "draft");
        setBrandSid(data.twilio_brand_sid);
        setCampaignSid(data.twilio_campaign_sid);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (status === null) {
    return variant === "compact" ? (
      <Skeleton className="h-10 w-full" />
    ) : (
      <Skeleton className="h-24 w-full" />
    );
  }

  if (hideWhenApproved && status === "approved") return null;

  const config = {
    none: {
      icon: ShieldAlert,
      tone: "border-destructive/30 bg-destructive/5",
      iconColor: "text-destructive",
      title: "SMS not registered",
      desc: "Register your business with Twilio A2P 10DLC before sending SMS campaigns.",
      cta: "Start registration",
    },
    draft: {
      icon: ShieldAlert,
      tone: "border-amber-500/30 bg-amber-500/5",
      iconColor: "text-amber-600 dark:text-amber-500",
      title: "Registration in progress",
      desc: "Complete your A2P 10DLC details and submit them to Twilio.",
      cta: "Continue",
    },
    submitted: {
      icon: Clock,
      tone: "border-blue-500/30 bg-blue-500/5",
      iconColor: "text-blue-600 dark:text-blue-500",
      title: "Pending Twilio approval",
      desc: "Your A2P 10DLC submission is under review. Approval typically takes 1–3 business days.",
      cta: "View status",
    },
    approved: {
      icon: CheckCircle2,
      tone: "border-emerald-500/30 bg-emerald-500/5",
      iconColor: "text-emerald-600 dark:text-emerald-500",
      title: "SMS approved",
      desc: brandSid && campaignSid ? `Brand ${brandSid.slice(0, 10)}… · Campaign ${campaignSid.slice(0, 10)}…` : "You're cleared to send compliant SMS campaigns.",
      cta: "Manage",
    },
    rejected: {
      icon: AlertCircle,
      tone: "border-destructive/40 bg-destructive/10",
      iconColor: "text-destructive",
      title: "Submission rejected",
      desc: "Twilio rejected your A2P 10DLC submission. Review feedback and resubmit.",
      cta: "Fix and resubmit",
    },
  }[status];

  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${config.tone}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${config.iconColor}`} />
          <span className="text-sm font-medium truncate">{config.title}</span>
          <Badge variant="outline" className="hidden sm:inline-flex text-xs uppercase">
            {status === "none" ? "not started" : status}
          </Badge>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/sms-compliance">{config.cta}</Link>
        </Button>
      </div>
    );
  }

  return (
    <Card className={config.tone}>
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.iconColor}`} />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{config.title}</p>
              <Badge variant="outline" className="text-xs uppercase">
                {status === "none" ? "not started" : status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{config.desc}</p>
          </div>
        </div>
        <Button asChild variant={status === "approved" ? "outline" : "default"}>
          <Link to="/sms-compliance">{config.cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
