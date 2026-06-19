import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import type { Interaction } from "@/components/ReviewCard";
import type { Platform } from "@/components/PlatformIcon";
import { safeText } from "@/lib/safeText";

const SUPPORTED_PLATFORMS: Platform[] = ["google", "facebook", "instagram", "yelp"];
export const REVIEWS_PAGE_SIZE = 20;

type Sentiment = "positive" | "negative" | "neutral";

export type InteractionWithSentiment = Interaction & {
  sentiment: Sentiment | null;
};

export type ReviewFilters = {
  /** "all" or one of the SUPPORTED_PLATFORMS */
  source?: string;
  /** "all" or a Sentiment */
  sentiment?: string;
  /** Free-text search across review text + author name */
  search?: string;
  /** ISO date string — only reviews on/after this date */
  dateFrom?: string;
  /** ISO date string — only reviews on/before this date */
  dateTo?: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function isSentiment(v: unknown): v is Sentiment {
  return v === "positive" || v === "negative" || v === "neutral";
}

// Escape `%` and `_` so user input doesn't act as ilike wildcards.
function escapeIlike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function useReviews(filters: ReviewFilters = {}) {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const source = filters.source && filters.source !== "all" ? filters.source : undefined;
  const sentiment =
    filters.sentiment && filters.sentiment !== "all" ? filters.sentiment : undefined;
  const search = filters.search?.trim() || undefined;
  const dateFrom = filters.dateFrom || undefined;
  const dateTo = filters.dateTo || undefined;

  // Realtime: invalidate the reviews feed on INSERT/UPDATE for this org so the
  // UI refreshes instantly without a full page reload.
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`reviews-feed-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviews",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["reviews", organizationId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reviews",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["reviews", organizationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  const query = useInfiniteQuery({
    queryKey: ["reviews", organizationId, { source, sentiment, search, dateFrom, dateTo }],
    enabled: !!organizationId,
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * REVIEWS_PAGE_SIZE;
      const to = from + REVIEWS_PAGE_SIZE - 1;

      let q = supabase
        .from("reviews")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("review_date", { ascending: false })
        .range(from, to);

      if (source) q = q.eq("source", source);
      if (sentiment) q = q.eq("sentiment", sentiment);
      if (dateFrom) q = q.gte("review_date", dateFrom);
      if (dateTo) q = q.lte("review_date", dateTo);
      if (search) {
        const pattern = `%${escapeIlike(search)}%`;
        // OR across text and author name
        q = q.or(`text.ilike.${pattern},author_name.ilike.${pattern}`);
      }

      const { data, error } = await q;
      if (error) throw error;

      const interactions: InteractionWithSentiment[] = (data ?? []).map((r) => {
        const platform: Platform = SUPPORTED_PLATFORMS.includes(r.source as Platform)
          ? (r.source as Platform)
          : "google";
        return {
          id: r.id,
          kind: "review",
          customerName: safeText(r.author_name, 200),
          platform,
          rating: r.rating ?? undefined,
          text: safeText(r.text ?? "", 5000),
          suggestedReply: r.reply_text ?? "",
          date: timeAgo(r.review_date),
          sentiment: isSentiment(r.sentiment) ? r.sentiment : null,
        };
      });
      return interactions;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < REVIEWS_PAGE_SIZE) return undefined;
      return allPages.length;
    },
  });

  const data = useMemo<InteractionWithSentiment[]>(
    () => query.data?.pages.flat() ?? [],
    [query.data],
  );

  return { ...query, data };
}
