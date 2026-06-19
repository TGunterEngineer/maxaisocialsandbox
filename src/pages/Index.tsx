import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardStats } from "@/components/DashboardStats";
import { RatingTrendChart } from "@/components/RatingTrendChart";
import { ReviewCard, type Interaction } from "@/components/ReviewCard";
import { supabase } from "@/integrations/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { A2pStatusBanner } from "@/components/A2pStatusBanner";
import { useReviews } from "@/hooks/useReviews";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { AddReviewDialog } from "@/components/AddReviewDialog";
import { CsvImportButton } from "@/components/CsvImportButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/useOrganization";

type Sentiment = "positive" | "negative" | "neutral";
type SentimentMap = Record<string, Sentiment>;

const Index = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  // In-memory cache for sentiments fetched from the AI in this session.
  const [pendingSentiments, setPendingSentiments] = useState<SentimentMap>({});
  const [filter, setFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const {
    data: realReviews,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useReviews({ source: sourceFilter, sentiment: filter });

  const sentinelRef = useInfiniteScroll<HTMLDivElement>(
    () => {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    },
    { enabled: !!hasNextPage && !isFetchingNextPage },
  );

  const reviews: Interaction[] = useMemo(
    () => (realReviews ?? []).map(({ sentiment, ...r }) => r),
    [realReviews],
  );

  // Combined sentiment lookup: DB-persisted (from useReviews) wins, otherwise pending.
  const sentiments: SentimentMap = useMemo(() => {
    const map: SentimentMap = { ...pendingSentiments };
    for (const r of realReviews ?? []) {
      if (r.sentiment) map[r.id] = r.sentiment;
    }
    return map;
  }, [realReviews, pendingSentiments]);

  // Only send reviews that have NO persisted sentiment AND no pending sentiment to the AI.
  useEffect(() => {
    if (reviews.length === 0) return;

    const unanalyzed = reviews.filter((r) => !sentiments[r.id] && r.text && r.text.trim().length > 0);
    if (unanalyzed.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("analyze-sentiment", {
          body: { reviews: unanalyzed.map((r) => ({ id: r.id, text: r.text })) },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.results) {
          setPendingSentiments((prev) => {
            const next = { ...prev };
            for (const r of data.results) next[r.id] = r.sentiment;
            return next;
          });
          queryClient.invalidateQueries({ queryKey: ["reviews", organizationId] });
        }
      } catch (e) {
        if (cancelled) return;
        console.error("Sentiment analysis failed:", e);
        toast({
          title: "Analysis delayed",
          description: "We couldn't analyze sentiments right now, but your reviews are still visible.",
          variant: "destructive",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [reviews, sentiments, queryClient, organizationId, toast]);

  // Filtering is performed server-side via useReviews({ source, sentiment }).
  const filteredReviews = reviews;

  const hasSentiments = Object.keys(sentiments).length > 0;

  return (
    <DashboardLayout title="Unified Inbox">
      <DashboardStats />
      <div className="mt-6"><A2pStatusBanner hideWhenApproved /></div>
      <div className="mt-6"><RatingTrendChart /></div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">
              Unified Inbox · Reviews, Comments & Mentions
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AddReviewDialog />
            <CsvImportButton />
            <Button asChild size="sm" variant="ghost">
              <Link to="/review-sources"><Settings2 className="h-3.5 w-3.5 mr-1" /> Sources</Link>
            </Button>
            <ToggleGroup type="single" value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v)} className="gap-1 flex-wrap justify-start">
              <ToggleGroupItem value="all" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">All sources</ToggleGroupItem>
              <ToggleGroupItem value="google" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Google</ToggleGroupItem>
              <ToggleGroupItem value="facebook" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Facebook</ToggleGroupItem>
              <ToggleGroupItem value="instagram" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Instagram</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v)} className="gap-1 flex-wrap justify-start">
              <ToggleGroupItem value="all" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">All</ToggleGroupItem>
              <ToggleGroupItem value="positive" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-success data-[state=on]:text-success-foreground" disabled={!hasSentiments}>Positive</ToggleGroupItem>
              <ToggleGroupItem value="neutral" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-muted data-[state=on]:text-foreground" disabled={!hasSentiments}>Neutral</ToggleGroupItem>
              <ToggleGroupItem value="negative" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground" disabled={!hasSentiments}>Negative</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <>{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full" />)}</>
          ) : filteredReviews.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-10 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-card-foreground mb-1">No reviews yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Add reviews manually, import a CSV, or connect a webhook ingest to start syncing real reviews.
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <AddReviewDialog />
                <CsvImportButton />
                <Button asChild size="sm" variant="outline">
                  <Link to="/review-sources">Manage sources</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {filteredReviews.map((review) => (
                <ReviewCard key={review.id} review={review} sentiment={sentiments[review.id] ?? null} />
              ))}
              <div ref={sentinelRef} className="h-1" aria-hidden />
              {isFetchingNextPage && <Skeleton className="h-40 w-full" />}
              {hasNextPage && !isFetchingNextPage && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
