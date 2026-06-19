import { useMemo } from "react";
import { PageSEO } from "@/components/PageSEO";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { useAnalytics } from "@/hooks/useAnalytics";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Mail, Star, MessageSquareWarning, TrendingUp, ExternalLink, Users } from "lucide-react";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success, 142 71% 45%))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-accent"
          : "text-primary";
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">{description}</p>
      )}
      <div className="mt-2">{children}</div>
    </div>
  );
}


const Analytics = () => {
  const { organizationId } = useOrganization();

  const { data: summary } = useAnalytics(organizationId);

  const campaignStats = useMemo(() => {
    const c = summary?.campaigns;
    return {
      total: c?.total ?? 0,
      sent: c?.sent ?? 0,
      responded: c?.responded ?? 0,
      responseRate: c?.response_rate ?? 0,
      routedGoogle: c?.routed_google ?? 0,
      routedFeedback: c?.routed_feedback ?? 0,
      avgRating: Number(c?.avg_rating ?? 0),
      ratingsCount: c?.ratings_count ?? 0,
    };
  }, [summary]);

  const ratingDistribution = useMemo(() => {
    const dist = summary?.campaigns.rating_distribution ?? {};
    return [1, 2, 3, 4, 5].map((star) => ({
      star: `${star}★`,
      count: Number(dist[String(star)] ?? 0),
    }));
  }, [summary]);

  const routingData = useMemo(
    () => [
      { name: "Routed to Google", value: campaignStats.routedGoogle },
      { name: "Private Feedback", value: campaignStats.routedFeedback },
    ],
    [campaignStats],
  );

  const sentimentTrend: { date: string; positive: number; neutral: number; negative: number }[] = [];

  const platformBreakdown: { platform: string; count: number }[] = [];

  const recentFeedback = summary?.recent_feedback ?? [];
  const feedbackTotal = summary?.feedback_total ?? 0;

  const hasAnyData = (summary?.campaigns.total ?? 0) > 0 || feedbackTotal > 0;

  if (organizationId && !hasAnyData) {
    return (
      <>
        <PageSEO title="Analytics" description="Review request performance, sentiment trends, and smart routing outcomes across your campaigns." />
        <DashboardLayout title="Analytics">
          <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center max-w-2xl mx-auto mt-8">
            <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-base font-semibold text-foreground mb-1.5">No analytics yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Send your first review request campaign — once recipients respond, you'll see ratings,
              routing outcomes, and sentiment trends here.
            </p>
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <PageSEO title="Analytics" description="Review request performance, sentiment trends, and smart routing outcomes across your campaigns." />
      <DashboardLayout title="Analytics">
      <div className="space-y-8">
        {/* Top KPI row */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Review Request Performance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Mail}
              label="Requests Sent"
              value={campaignStats.sent}
              sub={`${campaignStats.total} total recipients`}
            />
            <StatCard
              icon={Users}
              label="Responses"
              value={campaignStats.responded}
              sub={`${campaignStats.responseRate}% response rate`}
              tone="success"
            />
            <StatCard
              icon={Star}
              label="Avg Rating"
              value={campaignStats.avgRating || "—"}
              sub={`${campaignStats.ratingsCount} ratings collected`}
              tone="warning"
            />
            <StatCard
              icon={ExternalLink}
              label="Sent to Google"
              value={campaignStats.routedGoogle}
              sub={`${campaignStats.routedFeedback} routed to private`}
            />
          </div>
        </div>

        {/* Campaign performance charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Star Rating Distribution"
            description="Breakdown of ratings collected from your campaigns"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ratingDistribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="star" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Smart Routing Outcomes"
            description="4–5★ → Google · 1–3★ → private feedback"
          >
            {routingData.every((d) => d.value === 0) ? (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                No routing data yet — send a campaign to see results.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={routingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {routingData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={idx === 0 ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--accent))"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Cross-platform analytics */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Cross-Platform Reviews & Sentiment
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ChartCard
                title="Sentiment Trend — Last 30 Days"
                description="Daily share of positive, neutral, and negative mentions"
              >
                {sentimentTrend.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground text-center px-6">
                    Sentiment trend will appear once reviews are imported.
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={sentimentTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="positive"
                      stroke="hsl(var(--success, 142 71% 45%))"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="neutral"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="negative"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <ChartCard
              title="Mentions by Platform"
              description="Where your reviews & comments come from"
            >
              {platformBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground text-center px-6">
                  Connect a review source to see platform breakdown.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={platformBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      dataKey="count"
                      nameKey="platform"
                      label={(entry: { platform?: string; percent?: number }) =>
                        `${entry.platform ?? ""} ${((entry.percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                      fontSize={11}
                    >
                      {platformBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>

        {/* Recent private feedback */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Private Feedback
            </h2>
            <span className="text-xs text-muted-foreground">{feedbackTotal} total</span>
          </div>
          <div className="rounded-lg border bg-card shadow-sm divide-y">
            {recentFeedback.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <MessageSquareWarning className="h-6 w-6 text-muted-foreground" />
                No private feedback yet. Low ratings (1–3★) from your campaigns will appear here.
              </div>
            ) : (
              recentFeedback.map((f) => (
                <div key={f.id} className="p-4 flex gap-4">
                  <div className="shrink-0 flex flex-col items-center justify-center min-w-[48px]">
                    <span className="text-lg font-bold text-foreground">{f.rating}</span>
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">
                      stars
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{f.feedback}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(f.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-dashed bg-muted/30 p-4 flex items-start gap-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Branded PDF report export is coming next — you'll be able to email a monthly snapshot to clients in one click.
          </p>
        </div>
      </div>
    </DashboardLayout>
  </>
  );
};

export default Analytics;
