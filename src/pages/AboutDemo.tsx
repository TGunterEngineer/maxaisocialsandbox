import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSEO } from "@/components/PageSEO";
import { Link } from "react-router-dom";
import { Sparkles, MessageSquare, Wrench, Database, ShieldCheck, Zap } from "lucide-react";

export default function AboutDemo() {
  return (
    <DashboardLayout title="About this demo">
      <PageSEO title="About this demo" description="How this AI-powered reputation platform was built." />
      <div className="max-w-3xl space-y-6">
        <div>
          <Badge variant="outline" className="mb-2">Portfolio demo</Badge>
          <h1 className="text-3xl font-bold tracking-tight">About this demo</h1>
          <p className="text-muted-foreground mt-2">
            This is a full-stack reputation & customer-engagement product built end-to-end with AI assistance.
            Every visitor signs into a shared demo workspace seeded with realistic data so the product is
            immediately explorable.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-4 w-4" /> Where the AI lives</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-medium">Streaming reply composer</div>
              <div className="text-muted-foreground">Tone-controlled review responses streamed token-by-token from <code className="text-xs bg-muted px-1 py-0.5 rounded">google/gemini-3-flash-preview</code> via the Lovable AI Gateway. SSE → text decoder pipe.</div>
            </div>
            <div>
              <div className="font-medium">Voice-of-Customer RAG chat</div>
              <div className="text-muted-foreground">Live reviews are pulled from Postgres, packed into the system prompt with stable citation IDs, and the model is constrained to answer only from that corpus with inline <code className="text-xs bg-muted px-1 py-0.5 rounded">[#n]</code> citations.</div>
            </div>
            <div>
              <div className="font-medium">Insights agent (tool calling)</div>
              <div className="text-muted-foreground">A multi-step agent loop with 4 typed tools — <code className="text-xs">get_review_stats</code>, <code className="text-xs">get_top_themes</code>, <code className="text-xs">get_sample_reviews</code>, <code className="text-xs">get_location_breakdown</code>. The tool trace is exposed in the UI so reviewers can see exactly which tools were called and with what arguments.</div>
            </div>
            <Link to="/ai-lab" className="inline-block text-primary text-sm hover:underline">→ Try the AI Lab</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Database className="h-4 w-4" /> Architecture</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="font-medium">Frontend:</span> React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Tanstack Query + React Router.</div>
            <div><span className="font-medium">Backend:</span> Postgres with RLS, Edge Functions (Deno) for AI, ingestion, webhooks, and email/SMS dispatch.</div>
            <div><span className="font-medium">AI:</span> Lovable AI Gateway (OpenAI-compatible), Gemini 3 Flash for chat/agents, native SSE streaming.</div>
            <div><span className="font-medium">Integrations scaffolded:</span> Stripe billing, Twilio SMS (A2P), Resend transactional email, Outscraper review sync, webhook delivery system.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wrench className="h-4 w-4" /> Notable engineering</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              <li>30+ edge functions covering AI, payments, SMS compliance, email suppression, webhook delivery with retries.</li>
              <li>Row-level security on every table, role-based access via security-definer functions to avoid recursion.</li>
              <li>Multi-tenant org model with per-location access controls and team invitations.</li>
              <li>Idempotent demo seeding via service-role bootstrap function — every visitor gets a working workspace.</li>
              <li>Streaming-aware UI: token-level rendering, optimistic chat updates, tool-trace visualization.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> What's mocked vs real</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="font-medium">Real:</span> AI calls, database, RLS, edge functions, streaming.</div>
            <div><span className="font-medium">Mocked for demo:</span> outbound SMS/email sends are stubbed so the shared workspace doesn't text real numbers. Stripe is in test mode.</div>
            <div><span className="font-medium">Shared:</span> All visitors share one workspace, so edits are visible until the next reseed.</div>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-muted/30 p-4 flex items-center gap-3">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Built by [your name here]</div>
            <div className="text-muted-foreground">Add your name and links in <code className="text-xs">src/pages/AboutDemo.tsx</code>.</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
