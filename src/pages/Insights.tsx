import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageSEO } from "@/components/PageSEO";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

type InsightType = "trend" | "alert" | "opportunity" | "theme";
type Priority = "high" | "medium" | "low";

interface Insight {
  type: InsightType;
  title: string;
  detail: string;
  priority: Priority;
}

interface InsightsResponse {
  summary: string;
  insights: Insight[];
  data_points: number;
  generated_at?: string;
}

const TYPE_META: Record<
  InsightType,
  { icon: React.ElementType; label: string; ring: string; tint: string }
> = {
  trend: {
    icon: TrendingUp,
    label: "Trend",
    ring: "ring-primary/30",
    tint: "bg-primary/10 text-primary",
  },
  alert: {
    icon: AlertTriangle,
    label: "Alert",
    ring: "ring-destructive/30",
    tint: "bg-destructive/10 text-destructive",
  },
  opportunity: {
    icon: Lightbulb,
    label: "Opportunity",
    ring: "ring-accent/30",
    tint: "bg-accent/10 text-accent-foreground",
  },
  theme: {
    icon: MessageCircle,
    label: "Theme",
    ring: "ring-muted-foreground/20",
    tint: "bg-muted text-foreground",
  },
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-accent/15 text-accent-foreground",
  low: "bg-muted text-muted-foreground",
};

function InsightCard({ insight }: { insight: Insight }) {
  const meta = TYPE_META[insight.type];
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border bg-card p-5 shadow-sm ring-1 ${meta.ring}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${meta.tint}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${PRIORITY_BADGE[insight.priority]}`}
            >
              {insight.priority}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">
            {insight.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {insight.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

const Insights = () => {
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isFetching, error, refetch } = useQuery<InsightsResponse>({
    queryKey: ["ai_insights", organizationId, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: { organization_id: organizationId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as InsightsResponse;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleRefresh = async () => {
    setRefreshKey((k) => k + 1);
    try {
      await refetch();
      toast({ title: "Insights refreshed" });
    } catch {
      // error displayed below
    }
  };

  const errMsg = error instanceof Error ? error.message : null;

  return (
    <>
      <PageSEO title="AI Insights" description="AI-generated insights, trends, alerts, and opportunities from your reputation data and customer feedback." />
      <DashboardLayout title="AI Insights">
      <div className="space-y-6">
        <div className="rounded-lg border bg-gradient-to-br from-primary/10 via-card to-accent/5 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-[260px]">
              <div className="shrink-0 h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  AI-generated insights from your reputation data
                </h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {isLoading
                    ? "Analyzing your last 90 days of campaign data and customer feedback…"
                    : data?.summary ||
                      "We'll surface trends, alerts, and opportunities from your campaigns and private feedback."}
                </p>
                {data?.data_points !== undefined && data.data_points > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on {data.data_points} data points · last 90 days
                    {data.generated_at &&
                      ` · generated ${new Date(data.generated_at).toLocaleTimeString()}`}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isFetching || !organizationId}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {errMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {errMsg}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-5 shadow-sm">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1.5" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </div>
        ) : data?.insights && data.insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        ) : !errMsg ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
            <TrendingDown className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No insights yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Send your first review request campaign and collect a few responses — insights will start appearing here.
            </p>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  </>
  );
};

export default Insights;
