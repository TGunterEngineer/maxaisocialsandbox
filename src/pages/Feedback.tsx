import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { format, parseISO } from "date-fns";
import { MessageSquareWarning, Star } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { safeText } from "@/lib/safeText";

type FeedbackRow = {
  id: string;
  rating: number;
  feedback: string;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
};

export default function Feedback() {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feedback", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_responses")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FeedbackRow[];
    },
    enabled: !!organizationId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  // Realtime: refresh feedback feed instantly when new low-rating responses
  // arrive or existing rows are updated for this org.
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`feedback-feed-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feedback_responses",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["feedback", organizationId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "feedback_responses",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["feedback", organizationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);


  return (
    <DashboardLayout title="Private Feedback">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="h-7 w-7 text-primary" />
            Private Feedback
          </h1>
          <p className="text-muted-foreground mt-1">
            Low-rating responses (1-3 stars) routed here instead of going public.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageSquareWarning}
            title="No private feedback yet"
            description="When customers leave 1–3 star ratings on your campaigns, their notes are captured here instead of going to Google. Send a campaign to start collecting."
            action={
              <Button asChild>
                <Link to="/campaigns">Create a campaign</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {items.map((f) => (
              <Card key={f.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-4 w-4"
                              fill={i < f.rating ? "currentColor" : "transparent"}
                            />
                          ))}
                        </span>
                        {f.contact_name ? safeText(f.contact_name, 200) : "Anonymous"}
                      </CardTitle>
                      <CardDescription>
                        {f.contact_email ? safeText(f.contact_email, 320) : "No email"} · {format(parseISO(f.created_at), "PPp")}
                      </CardDescription>
                    </div>
                    <Badge variant={f.rating <= 2 ? "destructive" : "secondary"}>
                      {f.rating} star{f.rating === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap">{safeText(f.feedback, 5000)}</CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
