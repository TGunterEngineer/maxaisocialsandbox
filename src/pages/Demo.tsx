import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StarRating } from "@/components/StarRating";
import { SentimentBadge } from "@/components/SentimentBadge";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { mockReviews } from "@/data/mockReviews";
import {
  ArrowRight,
  Zap,
  Star,
  MessageSquare,
  TrendingUp,
  Sparkles,
  Eye,
  Send,
  Inbox,
  Check,
  Pencil,
  Loader2,
  Copy,
  CheckCheck,
} from "lucide-react";

type Sentiment = "positive" | "negative" | "neutral";

// Deterministic demo sentiment so the public demo never needs the AI gateway.
const demoSentiment = (text: string, rating?: number): Sentiment => {
  if (rating !== undefined) {
    if (rating >= 4) return "positive";
    if (rating <= 2) return "negative";
    return "neutral";
  }
  const t = text.toLowerCase();
  if (/(love|amazing|great|incredible|unreal|perfect|10\/10|🔥|💛|✨)/.test(t)) return "positive";
  if (/(slow|disappointing|bad|terrible|waited|disinterested)/.test(t)) return "negative";
  return "neutral";
};

const STATS = [
  { label: "Avg. rating", value: "4.7", icon: Star, accent: "text-amber-500" },
  { label: "Reviews this month", value: "138", icon: MessageSquare, accent: "text-primary" },
  { label: "Response rate", value: "98%", icon: Send, accent: "text-emerald-500" },
  { label: "Sentiment trend", value: "+12%", icon: TrendingUp, accent: "text-accent" },
];

const TREND = [3.8, 4.0, 4.1, 4.0, 4.2, 4.4, 4.3, 4.5, 4.6, 4.5, 4.7, 4.7];

export default function Demo() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");

  const enriched = useMemo(
    () => mockReviews.map((r) => ({ ...r, sentiment: demoSentiment(r.text, r.rating) })),
    [],
  );

  const filtered = useMemo(
    () =>
      enriched.filter((r) => {
        const sourceOk = sourceFilter === "all" || r.platform === sourceFilter;
        const sentimentOk = sentimentFilter === "all" || r.sentiment === sentimentFilter;
        return sourceOk && sentimentOk;
      }),
    [enriched, sourceFilter, sentimentFilter],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Live Demo · Maximum Social</title>
        <meta
          name="description"
          content="Interactive demo of Maximum Social — see AI review replies, smart routing, and sentiment analytics with sample data. No signup required."
        />
        <link rel="canonical" href="/demo" />
      </Helmet>

      {/* Nav */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">Maximum Social</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm">Back to home</Button>
            </Link>
            {user ? (
              <>
                <Link to="/pricing">
                  <Button size="sm" className="bg-gradient-to-r from-primary to-accent">
                    See pricing
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                >
                  Log out
                </Button>
              </>
            ) : (
              <Link to="/pricing">
                <Button size="sm" className="bg-gradient-to-r from-primary to-accent">
                  Get started
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Demo header */}
      <section className="border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Eye className="h-3 w-3" /> Live Demo · Sample data
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            See Maximum Social in action.
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            This is a preview of the unified inbox with sample reviews, AI-suggested replies,
            and live sentiment scoring. No signup required — explore freely.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <Card key={s.label} className="border-border/50 bg-card/50 backdrop-blur">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <s.icon className={`h-4 w-4 ${s.accent}`} />
                </div>
                <div className="text-2xl font-bold tracking-tight">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trend chart (lightweight SVG) */}
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">Rating trend</h2>
                <p className="text-xs text-muted-foreground">Last 12 weeks</p>
              </div>
              <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/30">
                <TrendingUp className="h-3 w-3" /> +0.9 stars
              </Badge>
            </div>
            <TrendChart data={TREND} />
          </CardContent>
        </Card>

        {/* Inbox */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Inbox className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">
                Unified Inbox · Reviews, Comments & Mentions
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ToggleGroup
                type="single"
                value={sourceFilter}
                onValueChange={(v) => v && setSourceFilter(v)}
                className="gap-1 flex-wrap"
              >
                <ToggleGroupItem value="all" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">All</ToggleGroupItem>
                <ToggleGroupItem value="google" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Google</ToggleGroupItem>
                <ToggleGroupItem value="facebook" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Facebook</ToggleGroupItem>
                <ToggleGroupItem value="instagram" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Instagram</ToggleGroupItem>
                <ToggleGroupItem value="yelp" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Yelp</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                type="single"
                value={sentimentFilter}
                onValueChange={(v) => v && setSentimentFilter(v)}
                className="gap-1 flex-wrap"
              >
                <ToggleGroupItem value="all" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">All sentiment</ToggleGroupItem>
                <ToggleGroupItem value="positive" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-success data-[state=on]:text-success-foreground">Positive</ToggleGroupItem>
                <ToggleGroupItem value="neutral" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-muted data-[state=on]:text-foreground">Neutral</ToggleGroupItem>
                <ToggleGroupItem value="negative" size="sm" className="text-xs px-3 h-8 data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground">Negative</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
                No items match your filters.
              </div>
            ) : (
              filtered.map((r, idx) => (
                <DemoReviewCard
                  key={r.id}
                  index={idx}
                  customerName={r.customerName}
                  platform={r.platform}
                  rating={r.rating}
                  kind={r.kind}
                  text={r.text}
                  suggestedReply={r.suggestedReply}
                  date={r.date}
                  sentiment={r.sentiment}
                />
              ))
            )}
          </div>
        </div>

        {/* CTA */}
        <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
          <CardContent className="relative p-10 text-center">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              Ready to plug in your real reviews?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Connect Google, Yelp, Facebook, and Instagram in minutes. AI replies,
              sentiment, and outreach campaigns — all set up for you.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent group">
                  Get started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">See pricing</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/50 py-8 mt-10">
        <div className="max-w-7xl mx-auto px-6 text-sm text-muted-foreground flex items-center justify-between flex-wrap gap-4">
          <span>© {new Date().getFullYear()} Maximum Social — Demo data shown</span>
          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Local read-only review card (no auth/org dependencies) ---------- */

interface DemoCardProps {
  index: number;
  customerName: string;
  platform: Platform;
  rating?: number;
  kind: "review" | "comment" | "mention";
  text: string;
  suggestedReply: string;
  date: string;
  sentiment: Sentiment;
}

// Pre-written tone variants used to simulate "Regenerate Draft" without
// hitting the AI gateway from the public demo.
const TONE_VARIANTS: Record<"formal" | "friendly" | "apologetic", (name: string) => string> = {
  formal: (n) =>
    `Dear ${n.replace(/^@/, "")}, thank you for taking the time to share your experience. We genuinely appreciate your feedback and look forward to serving you again soon.`,
  friendly: (n) =>
    `Hey ${n.replace(/^@/, "")}! 🙌 Thanks so much for the kind words — made our whole team smile. Can't wait to see you back soon!`,
  apologetic: (n) =>
    `Hi ${n.replace(/^@/, "")}, we're truly sorry your experience didn't meet expectations. Please reach out to us directly so we can make it right — your feedback means a lot.`,
};

function DemoReviewCard({
  index,
  customerName,
  platform,
  rating,
  kind,
  text,
  suggestedReply,
  date,
  sentiment,
}: DemoCardProps) {
  const [reply, setReply] = useState(suggestedReply);
  const [editing, setEditing] = useState(false);
  const [tone, setTone] = useState<"formal" | "friendly" | "apologetic">(
    sentiment === "negative" ? "apologetic" : kind === "review" ? "formal" : "friendly",
  );
  const [seoBoost, setSeoBoost] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset reply when the underlying suggestion changes (filter swaps don't,
  // but kept for safety).
  useEffect(() => {
    setReply(suggestedReply);
    setPosted(false);
  }, [suggestedReply]);

  const isReview = kind === "review";

  const handleApprove = () => {
    if (!reply.trim()) {
      toast.error("Reply is empty");
      return;
    }
    setPosting(true);
    setTimeout(() => {
      setPosting(false);
      setPosted(true);
      toast.success(`Reply approved for ${customerName} (demo)`);
    }, 700);
  };

  const handleRegenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const base = TONE_VARIANTS[tone](customerName);
      const seoSuffix = seoBoost
        ? " We're proud to be one of Chicago's top-rated local spots — thanks for supporting us!"
        : "";
      setReply(base + seoSuffix);
      setEditing(true);
      setGenerating(false);
      toast.success("AI draft generated! Edit before posting.");
    }, 900);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      toast.success("Reply copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  const sentimentStyles =
    sentiment === "negative"
      ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
      : sentiment === "positive"
      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50"
      : "bg-card";
  const sentimentEmoji = sentiment === "negative" ? "😡" : sentiment === "positive" ? "😊" : null;
  const kindLabel = kind === "review" ? "Review" : kind === "comment" ? "Comment" : "Mention";

  return (
    <div
      className={`rounded-lg border p-5 shadow-sm transition-shadow hover:shadow-md relative ${sentimentStyles}`}
    >
      {sentimentEmoji && (
        <span className="absolute top-3 right-3 text-lg" title={`${sentiment} sentiment`}>
          {sentimentEmoji}
        </span>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <PlatformIcon platform={platform} showLabel={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold text-card-foreground">{customerName}</h3>
            <span className="text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
              {kindLabel}
            </span>
            <SentimentBadge sentiment={sentiment} />
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {isReview && rating !== undefined && <StarRating rating={rating} />}
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-card-foreground/85 leading-relaxed mb-4">"{text}"</p>

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
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mr-1">
            Tone:
          </span>
          <ToggleGroup
            type="single"
            value={tone}
            onValueChange={(v) => v && setTone(v as typeof tone)}
            className="gap-0.5"
          >
            <ToggleGroupItem
              value="formal"
              size="sm"
              className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Formal
            </ToggleGroupItem>
            <ToggleGroupItem
              value="friendly"
              size="sm"
              className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Friendly
            </ToggleGroupItem>
            <ToggleGroupItem
              value="apologetic"
              size="sm"
              className="text-[11px] px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Apologetic
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id={`demo-seo-${index}`}
              checked={seoBoost}
              onCheckedChange={setSeoBoost}
            />
            <Label
              htmlFor={`demo-seo-${index}`}
              className="text-[11px] font-medium text-muted-foreground cursor-pointer select-none"
            >
              SEO Boost
            </Label>
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button size="sm" onClick={handleApprove} disabled={posted || posting}>
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
            onClick={handleRegenerate}
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
          <Button size="sm" variant="ghost" onClick={handleCopy} className="ml-auto">
            {copied ? (
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Lightweight inline trend chart ---------- */

function TrendChart({ data }: { data: number[] }) {
  const w = 100;
  const h = 30;
  const min = Math.min(...data) - 0.2;
  const max = Math.max(...data) + 0.2;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-32">
      <defs>
        <linearGradient id="demoTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#demoTrendFill)" />
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="0.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
