import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AlertCircle, CheckCircle2, MessageSquareText, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Skeleton } from "@/components/ui/skeleton";

interface StatItem {
  label: string;
  value: string;
  icon: typeof AlertCircle;
  color: string;
}

export function DashboardStats() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", organizationId],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows, error } = await supabase
        .from("reviews")
        .select("id, rating, replied_at, reply_text, created_at")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      const reviews = rows ?? [];
      const total = reviews.length;
      const needingAction = reviews.filter(
        (r) => (r.rating ?? 5) <= 2 && !r.reply_text,
      ).length;
      const repliedThisWeek = reviews.filter(
        (r) => r.replied_at && r.replied_at >= sevenDaysAgo,
      ).length;
      const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === "number");
      const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      return { total, needingAction, repliedThisWeek, avg };
    },
    enabled: !!organizationId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  // Realtime: refresh stats instantly when reviews change for this org.
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`dashboard-stats-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviews",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-stats", organizationId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reviews",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-stats", organizationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  const stats: StatItem[] = [
    { label: "Needing Action", value: String(data?.needingAction ?? 0), icon: AlertCircle, color: "text-destructive" },
    { label: "Replied This Week", value: String(data?.repliedThisWeek ?? 0), icon: CheckCircle2, color: "text-success" },
    { label: "Total Reviews", value: String(data?.total ?? 0), icon: MessageSquareText, color: "text-primary" },
    { label: "Avg Rating", value: data?.avg ? data.avg.toFixed(1) : "—", icon: Star, color: "text-star" },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[88px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </div>
          <p className="text-2xl font-bold text-card-foreground mt-1">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
