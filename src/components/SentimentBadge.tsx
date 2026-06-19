import { Badge } from "@/components/ui/badge";

type Sentiment = "positive" | "negative" | "neutral";

const config: Record<Sentiment, { label: string; className: string }> = {
  positive: { label: "Positive", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" },
  negative: { label: "Negative", className: "bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/20" },
  neutral: { label: "Neutral", className: "bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/20" },
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment | null }) {
  if (!sentiment) {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 animate-pulse bg-muted/50 text-muted-foreground border-border">
        Analyzing…
      </Badge>
    );
  }

  const { label, className } = config[sentiment];
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold ${className}`}>
      {label}
    </Badge>
  );
}
