import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsSummary = {
  campaigns: {
    total: number;
    sent: number;
    responded: number;
    response_rate: number;
    routed_google: number;
    routed_feedback: number;
    avg_rating: number;
    ratings_count: number;
    rating_distribution: Record<string, number>;
  };
  reviews: {
    total: number;
    avg_rating: number;
    sentiment: { positive: number; neutral: number; negative: number; unrated: number };
  };
  feedback_total: number;
  recent_feedback: Array<{ id: string; rating: number; feedback: string; created_at: string }>;
};

export function useAnalytics(organizationId: string | null | undefined) {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics_summary", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_analytics_summary", {
        _org_id: organizationId!,
      });
      if (error) throw error;
      return data as unknown as AnalyticsSummary;
    },
  });
}
