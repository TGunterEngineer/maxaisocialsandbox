import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { SentimentBadge } from "@/components/SentimentBadge";
import { PlatformIcon } from "@/components/PlatformIcon";
import {
  Shield, Sparkles, Star, MessageSquare, Send, TrendingUp,
  Inbox, Megaphone, Brain, Webhook, Globe, ExternalLink,
  Crown, Zap, Check, Pencil, Loader2, AlertTriangle, ArrowLeft, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import {
  MAX_AI_BRAND, maxAiReviews, maxAiStats, maxAiTrend,
  maxAiCampaigns, maxAiFeedback, maxAiInsights, maxAiWebhooks,
  type DemoReview,
} from "@/data/maxAiMockData";

export default function SuperAdminDemo() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout title="Founder Demo">
        <Skeleton className="h-64 w-full" />
      </DashboardLayout>
    );
  }
  if (!isAdmin) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <DashboardLayout title="Founder Demo">
      <Helmet>
        <title>Founder Demo · Maximum AI Consulting</title>
      </Helmet>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero */}
        <Card className="relative overflow-hidden border-primary/30">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: `radial-gradient(ellipse at top right, ${MAX_AI_BRAND.primaryColor}, transparent 60%)`,
            }}
          />
          <CardContent className="relative p-8 flex flex-wrap items-start gap-6 justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
                  <Crown className="h-3 w-3" /> Founder Demo · Admin Only
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <Sparkles className="h-3 w-3" /> Premium tier preview
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Shield className="h-7 w-7 text-primary" />
                {MAX_AI_BRAND.name}
              </h1>
              <p className="text-muted-foreground max-w-xl">
                {MAX_AI_BRAND.tagline}. This workspace is a fully-loaded demo of every premium
                feature in Maximum Social — populated with simulated data for{" "}
                <span className="font-mono text-foreground">{MAX_AI_BRAND.domain}</span>.
              </p>
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <a
                  href={MAX_AI_BRAND.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  {MAX_AI_BRAND.domain}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-xs text-muted-foreground">· {MAX_AI_BRAND.city}</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/super-admin")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Super Admin
            </Button>
          </CardContent>
        </Card>

        {/* Stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Avg. rating" value={maxAiStats.avgRating.toFixed(1)} icon={Star} accent="text-amber-500" />
          <StatCard label="Reviews (total)" value={String(maxAiStats.totalReviews)} icon={MessageSquare} accent="text-primary" />
          <StatCard label="This month" value={`+${maxAiStats.monthReviews}`} icon={TrendingUp} accent="text-emerald-500" />
          <StatCard label="Response rate" value={`${maxAiStats.responseRate}%`} icon={Send} accent="text-blue-500" />
          <StatCard label="Pipeline influenced" value={`$${(maxAiStats.pipelineValueUsd / 1000).toFixed(0)}k`} icon={DollarSign} accent="text-violet-500" />
        </div>

        <Tabs defaultValue="inbox" className="space-y-5">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
            <TabsTrigger value="inbox"><Inbox className="h-4 w-4 mr-1.5" />Inbox</TabsTrigger>
            <TabsTrigger value="analytics"><TrendingUp className="h-4 w-4 mr-1.5" />Analytics</TabsTrigger>
            <TabsTrigger value="campaigns"><Megaphone className="h-4 w-4 mr-1.5" />Campaigns</TabsTrigger>
            <TabsTrigger value="feedback"><MessageSquare className="h-4 w-4 mr-1.5" />Feedback</TabsTrigger>
            <TabsTrigger value="insights"><Brain className="h-4 w-4 mr-1.5" />AI Insights</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1.5" />Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-4">
            <SectionTitle
              icon={Inbox}
              title="Unified Inbox"
              subtitle="All reviews, comments and mentions across Google, Yelp, Facebook and Instagram — with AI-drafted replies ready to approve."
            />
            {maxAiReviews.map((r) => (
              <DemoReviewCard key={r.id} review={r} />
            ))}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <SectionTitle
              icon={TrendingUp}
              title="Rating & Sentiment Analytics"
              subtitle="12-week trend of average rating and inbound review volume."
            />
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Average rating</p>
                    <p className="text-3xl font-bold">{maxAiStats.avgRating.toFixed(1)} ★</p>
                  </div>
                  <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/30">
                    <TrendingUp className="h-3 w-3" /> +{maxAiStats.sentimentTrend}% sentiment
                  </Badge>
                </div>
                <TrendChart data={maxAiTrend} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Google", count: 142, avg: 4.8 },
                { label: "Yelp", count: 26, avg: 4.5 },
                { label: "Facebook / IG", count: 16, avg: 4.7 },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-semibold mt-1">{s.avg.toFixed(1)} ★</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.count} reviews</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <SectionTitle
              icon={Megaphone}
              title="Review Request Campaigns"
              subtitle="Email + SMS outreach that drove 41 new 5-star reviews last quarter."
            />
            <div className="space-y-3">
              {maxAiCampaigns.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{c.name}</h3>
                          <Badge variant="outline" className="uppercase text-[10px]">
                            {c.channel}
                          </Badge>
                          <Badge
                            variant={c.status === "active" ? "default" : "secondary"}
                            className="uppercase text-[10px]"
                          >
                            {c.status}
                          </Badge>
                        </div>
                        {c.sent > 0 ? (
                          <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                            <Metric label="Sent" value={c.sent} />
                            <Metric label="Opened" value={c.opened} />
                            <Metric label="Rated" value={c.rated} />
                            <Metric label="5★" value={c.fiveStar} accent />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-2">
                            Scheduled for first send in 3 days.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            <SectionTitle
              icon={MessageSquare}
              title="Private Feedback (rating gate)"
              subtitle="Low ratings (≤ 3★) route here privately instead of going public. Resolve quietly, then invite happy customers to post a public review."
            />
            {maxAiFeedback.map((f) => (
              <Card key={f.id} className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{f.name}</span>
                      <StarRating rating={f.rating} />
                    </div>
                    <span className="text-xs text-muted-foreground">{f.when}</span>
                  </div>
                  <p className="text-sm text-card-foreground/85 italic">"{f.text}"</p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline">Reply privately</Button>
                    <Button size="sm" variant="ghost">Mark resolved</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <SectionTitle
              icon={Brain}
              title="AI Insights"
              subtitle="Themes and recommendations auto-generated from your last 90 days of reviews and feedback."
            />
            {maxAiInsights.map((i) => (
              <Card
                key={i.id}
                className={
                  i.severity === "high"
                    ? "border-red-500/30 bg-red-500/5"
                    : i.severity === "medium"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-primary/20"
                }
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {i.severity === "high" ? (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Sparkles className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{i.title}</h3>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {i.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {i.body}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <SectionTitle
              icon={Webhook}
              title="Premium Webhooks"
              subtitle="HMAC-signed outbound webhooks for rating.submitted, review.created and feedback.received. Plug into Slack, Zapier, Make.com, or your own backend."
            />
            {maxAiWebhooks.map((w) => (
              <Card key={w.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{w.name}</h3>
                      <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                        {w.url}
                      </p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {w.events.map((e) => (
                          <Badge key={e} variant="secondary" className="text-[10px] font-mono">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Last 24h</p>
                      <p className="text-lg font-semibold">{w.deliveries24h}</p>
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">
                        {w.successRate}% ok
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ---------- Helpers ---------- */

function StatCard({
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: React.ElementType; accent: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  icon: Icon, title, subtitle,
}: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${accent ? "text-amber-500" : ""}`}>{value}</p>
    </div>
  );
}

function DemoReviewCard({ review }: { review: DemoReview }) {
  const [reply, setReply] = useState(review.suggestedReply);
  const [editing, setEditing] = useState(false);
  const [posted, setPosted] = useState(review.status === "replied");
  const [generating, setGenerating] = useState(false);

  const tone =
    review.sentiment === "negative"
      ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
      : review.sentiment === "positive"
      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50"
      : "bg-card";

  return (
    <div className={`rounded-lg border p-5 shadow-sm transition-shadow hover:shadow-md ${tone}`}>
      <div className="flex items-start gap-3 mb-3">
        <PlatformIcon platform={review.platform} showLabel={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold">{review.customerName}</h3>
            <span className="text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
              {review.kind}
            </span>
            <SentimentBadge sentiment={review.sentiment} />
            {review.status === "escalated" && (
              <Badge variant="destructive" className="text-[10px]">Escalated</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {review.rating !== undefined && <StarRating rating={review.rating} />}
            <span className="text-xs text-muted-foreground">{review.date}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-card-foreground/85 leading-relaxed mb-4">"{review.text}"</p>

      <div className="rounded-md border bg-muted/40 p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            AI Draft Reply
          </span>
        </div>
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          readOnly={!editing}
          className="min-h-[72px] text-sm bg-card resize-none"
        />
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button
            size="sm"
            onClick={() => {
              setPosted(true);
              toast.success(`Reply approved for ${review.customerName} (demo)`);
            }}
            disabled={posted}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            {posted ? "Posted ✓" : "Approve & Post"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setGenerating(true);
              setTimeout(() => {
                setReply(review.suggestedReply + " — Thanks again from the Maximum AI team!");
                setEditing(true);
                setGenerating(false);
                toast.success("Regenerated draft");
              }, 600);
            }}
            disabled={generating}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1" />
            )}
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-32">
      <defs>
        <linearGradient id="maxAiTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill="url(#maxAiTrendFill)" />
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
