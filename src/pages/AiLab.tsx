import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, MessageSquare, Wrench, Send, RotateCcw, Star } from "lucide-react";
import { PageSEO } from "@/components/PageSEO";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-lab`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

async function streamCall(body: any, onToken: (t: string) => void) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text();
    throw new Error(t || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onToken(dec.decode(value, { stream: true }));
  }
}

async function jsonCall(body: any) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// ============== REPLY COMPOSER ==============
const SAMPLE_REVIEWS = [
  { name: "Sarah K.", rating: 5, text: "Absolutely loved this place. The staff were warm, the food came out fast, and the atmosphere was perfect for a date night." },
  { name: "Marcus T.", rating: 2, text: "Waited 35 minutes for our table even with a reservation. Food was fine but the wait killed the experience." },
  { name: "Priya R.", rating: 4, text: "Great spot, slightly overpriced for the portion size, but the quality is undeniable. Would come back." },
];
const TONES = [
  { id: "warm", label: "Warm" },
  { id: "apologetic", label: "Apologetic" },
  { id: "witty", label: "Witty" },
  { id: "professional", label: "Professional" },
];

function ReplyComposer() {
  const [review, setReview] = useState(SAMPLE_REVIEWS[1]);
  const [tone, setTone] = useState("apologetic");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const generate = async () => {
    setOutput("");
    setErr(null);
    setLoading(true);
    try {
      await streamCall(
        { mode: "reply", reviewText: review.text, customerName: review.name, rating: review.rating, tone },
        (t) => setOutput((p) => p + t),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pick a sample review</CardTitle>
          <CardDescription>Or edit the text — anything goes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {SAMPLE_REVIEWS.map((r, i) => (
              <Button key={i} size="sm" variant={review === r ? "default" : "outline"} onClick={() => setReview(r)}>
                {r.rating}★ {r.name}
              </Button>
            ))}
          </div>
          <Input value={review.name} onChange={(e) => setReview({ ...review, name: e.target.value })} placeholder="Customer name" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setReview({ ...review, rating: n })} className="p-1">
                <Star className={`h-5 w-5 ${n <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea rows={5} value={review.text} onChange={(e) => setReview({ ...review, text: e.target.value })} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Tone</div>
            <div className="flex gap-2 flex-wrap">
              {TONES.map((t) => (
                <Button key={t.id} size="sm" variant={tone === t.id ? "default" : "outline"} onClick={() => setTone(t.id)}>
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={generate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate streaming reply
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI-generated reply</CardTitle>
          <CardDescription>Streams token-by-token from Lovable AI Gateway.</CardDescription>
        </CardHeader>
        <CardContent>
          {err && <div className="text-sm text-destructive mb-2">{err}</div>}
          <div className="min-h-[220px] rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {output || <span className="text-muted-foreground">Reply will appear here…</span>}
            {loading && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== RAG CHAT ==============
function AskReviews() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Ask me anything about the 60+ customer reviews in this workspace. Try: *What do customers love most?* or *What's the biggest complaint at Westside?*" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: q }, { role: "assistant" as const, content: "" }];
    setMessages(next);
    setLoading(true);
    try {
      await streamCall(
        { mode: "ask-reviews", question: q, history: messages.slice(-6) },
        (t) => {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + t };
            return copy;
          });
        },
      );
    } catch (e) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `Error: ${(e as Error).message}` };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Voice-of-Customer Chat</CardTitle>
        <CardDescription>RAG over the seeded demo reviews. Answers cite source reviews like [#3].</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px] pr-4 mb-3">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.content || <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            value={input}
            placeholder="Ask about your reviews…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            "What do customers love most?",
            "What's the biggest complaint?",
            "How does sentiment differ by location?",
            "Quote three 5-star reviews.",
          ].map((q) => (
            <Button key={q} variant="outline" size="sm" onClick={() => setInput(q)}>
              {q}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============== INSIGHTS AGENT ==============
function InsightsAgent() {
  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<any[]>([]);
  const [summary, setSummary] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setTrace([]);
    setSummary("");
    setErr(null);
    try {
      const res = await jsonCall({ mode: "insights-agent" });
      setTrace(res.trace ?? []);
      setSummary(res.summary ?? "");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid md:grid-cols-5 gap-4">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" /> Agent tool trace</CardTitle>
          <CardDescription>Each step the agent took. Tools run against the live demo data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={run} disabled={running} className="w-full mb-3">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Run analysis
          </Button>
          <ScrollArea className="h-[420px] pr-3">
            {!trace.length && !running && <div className="text-sm text-muted-foreground">No steps yet. Click run.</div>}
            <div className="space-y-2">
              {trace.map((step, i) => (
                <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono">#{i + 1}</Badge>
                    <span className="font-mono font-medium">{step.tool}</span>
                  </div>
                  <div className="text-muted-foreground font-mono break-all mb-1">args: {JSON.stringify(step.args)}</div>
                  <pre className="text-[10px] bg-background rounded p-2 overflow-auto max-h-32">{JSON.stringify(step.result, null, 2)}</pre>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Executive summary</CardTitle>
          <CardDescription>Final synthesis after the agent finished calling tools.</CardDescription>
        </CardHeader>
        <CardContent>
          {err && <div className="text-sm text-destructive mb-2">{err}</div>}
          {!summary && !running && <div className="text-sm text-muted-foreground">Run the agent to see the report.</div>}
          {running && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Agent is reasoning…</div>}
          {summary && (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{summary}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AiLab() {
  return (
    <DashboardLayout title="AI Lab">
      <PageSEO title="AI Lab — Live AI Demos" description="Streaming reply composer, RAG chat over customer reviews, and a tool-calling insights agent." />
      <div className="space-y-4 max-w-6xl">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Lab</h1>
            <p className="text-sm text-muted-foreground">
              Three live AI features built on Lovable AI Gateway — streaming, RAG, and tool-calling agents. Everything you see runs server-side against the demo data.
            </p>
          </div>
        </div>

        <Tabs defaultValue="reply">
          <TabsList>
            <TabsTrigger value="reply"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Streaming Reply</TabsTrigger>
            <TabsTrigger value="rag"><MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Ask Your Reviews (RAG)</TabsTrigger>
            <TabsTrigger value="agent"><Wrench className="h-3.5 w-3.5 mr-1.5" /> Insights Agent</TabsTrigger>
          </TabsList>
          <TabsContent value="reply" className="mt-4"><ReplyComposer /></TabsContent>
          <TabsContent value="rag" className="mt-4"><AskReviews /></TabsContent>
          <TabsContent value="agent" className="mt-4"><InsightsAgent /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
