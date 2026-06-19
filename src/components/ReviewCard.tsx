import { useState, useEffect } from "react";
import { Check, Pencil, Sparkles, Loader2, Copy, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StarRating } from "@/components/StarRating";
import { SentimentBadge } from "@/components/SentimentBadge";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTone } from "@/contexts/ToneContext";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/useOrganization";

export type InteractionKind = "review" | "comment" | "mention";

export interface Interaction {
  id: string;
  kind: InteractionKind;
  customerName: string;
  platform: Platform;
  rating?: number;
  text: string;
  suggestedReply: string;
  date: string;
}

// Backwards compatibility
export type Review = Interaction;

interface ReviewCardProps {
  review: Interaction;
  sentiment: "positive" | "negative" | "neutral" | null;
}

const kindLabels: Record<InteractionKind, string> = {
  review: "Review",
  comment: "Comment",
  mention: "Mention",
};

export function ReviewCard({ review, sentiment }: ReviewCardProps) {
  const { globalTone } = useTone();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const [reply, setReply] = useState(review.suggestedReply);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [tone, setTone] = useState<string>(globalTone);
  const [seoBoost, setSeoBoost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [posted, setPosted] = useState<boolean>(false);

  useEffect(() => { setTone(globalTone); }, [globalTone]);

  // Treat demo IDs (non-uuid) as non-persistable
  const isPersistable = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(review.id);
  const isReview = review.kind === "review";

  const handleCopyToClipboard = async () => {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    toast.success("Reply copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprovePost = async () => {
    if (!reply.trim()) {
      toast.error("Reply is empty");
      return;
    }

    // Demo / non-persisted reviews: simulate
    if (!isPersistable) {
      setPosted(true);
      toast.success(`Reply approved for ${review.customerName} (demo)`);
      return;
    }

    setPosting(true);
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ reply_text: reply, replied_at: new Date().toISOString() })
        .eq("id", review.id);
      if (error) throw error;

      setPosted(true);
      toast.success(
        `Reply saved for ${review.customerName}. Native posting to ${review.platform} requires connecting that source.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["reviews", organizationId] });
    } catch (e: any) {
      console.error("Approve & post error:", e);
      toast.error(e.message || "Failed to save reply");
    } finally {
      setPosting(false);
    }
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-reply", {
        body: {
          reviewText: review.text,
          customerName: review.customerName,
          rating: review.rating ?? 5,
          platform: review.platform,
          kind: review.kind,
          tone,
          seoBoost,
          businessName: "Maximum Social",
          businessLocation: "Chicago",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setReply(data.reply);
      setEditing(true);
      toast.success("AI draft generated! Edit before posting.");
    } catch (e: any) {
      console.error("AI generation error:", e);
      toast.error(e.message || "Failed to generate AI response");
    } finally {
      setGenerating(false);
    }
  };

  const sentimentStyles = sentiment === "negative"
    ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
    : sentiment === "positive"
    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50"
    : "bg-card";

  const sentimentEmoji = sentiment === "negative" ? "😡" : sentiment === "positive" ? "😊" : null;

  return (
    <div className={`rounded-lg border p-5 shadow-sm transition-shadow hover:shadow-md relative ${sentimentStyles}`}>
      {sentimentEmoji && (
        <span className="absolute top-3 right-3 text-lg" title={`${sentiment} sentiment`}>
          {sentimentEmoji}
        </span>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <PlatformIcon platform={review.platform} showLabel={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold text-card-foreground">{review.customerName}</h3>
            <span className="text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
              {kindLabels[review.kind]}
            </span>
            <SentimentBadge sentiment={sentiment} />
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {isReview && review.rating != null && <StarRating rating={review.rating} />}
            <span className="text-xs text-muted-foreground">{review.date}</span>
          </div>
        </div>
      </div>

      {/* Interaction text — review.text is already sanitized by useReviews/safeText.
          React's default text interpolation prevents HTML/JS execution. */}
      <p className="text-sm text-card-foreground/85 leading-relaxed mb-4">
        {review.text ? `"${review.text}"` : <span className="italic text-muted-foreground">No comment provided</span>}
      </p>

      {/* AI Draft Assistant */}
      <div className="rounded-md border bg-muted/40 p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            AI Draft Assistant {isReview ? "· Formal Response" : "· Engaging Reply"}
          </span>
        </div>
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          readOnly={!editing}
          className={`min-h-[80px] text-sm bg-card border-border resize-none ${
            !editing ? "cursor-default focus:ring-0" : ""
          }`}
        />
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mr-1">Tone:</span>
          <ToggleGroup
            type="single"
            value={tone}
            onValueChange={(v) => v && setTone(v)}
            className="gap-0.5"
          >
            <ToggleGroupItem value="formal" size="sm" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Formal
            </ToggleGroupItem>
            <ToggleGroupItem value="friendly" size="sm" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Friendly
            </ToggleGroupItem>
            <ToggleGroupItem value="apologetic" size="sm" className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Apologetic
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2 ml-auto">
            <Switch id={`seo-${review.id}`} checked={seoBoost} onCheckedChange={setSeoBoost} />
            <Label htmlFor={`seo-${review.id}`} className="text-[11px] font-medium text-muted-foreground cursor-pointer select-none">
              SEO Boost
            </Label>
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button
            size="sm"
            onClick={handleApprovePost}
            disabled={posted || posting}
          >
            {posting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1" />
            )}
            {posted ? "Posted ✓" : posting ? "Saving..." : "Approve & Post"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit Reply
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateAI}
            disabled={generating}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1" />
            )}
            {generating ? "Generating..." : "Regenerate Draft"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyToClipboard}
            className="ml-auto"
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}
