import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Webhook, Trash2, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { WebhookDeliveriesTable } from "@/components/WebhookDeliveriesTable";
import { z } from "zod";

type EventType = "rating.submitted" | "review.created" | "feedback.received";

const EVENT_OPTIONS: { value: EventType; label: string; description: string }[] = [
  { value: "rating.submitted", label: "rating.submitted", description: "A customer submits a star rating from a campaign link." },
  { value: "review.created", label: "review.created", description: "A new review is ingested from any source (Google, manual, API, etc.)." },
  { value: "feedback.received", label: "feedback.received", description: "A low-rating customer leaves private feedback." },
];

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().url("Must be a valid HTTPS URL").startsWith("https://", "URL must start with https://"),
  event_type: z.enum(["rating.submitted", "review.created", "feedback.received"]),
});

const SAMPLE_PAYLOADS: Record<EventType, Record<string, unknown>> = {
  "rating.submitted": {
    event: "rating.submitted",
    occurred_at: "2025-01-01T12:00:00Z",
    organization_id: "uuid",
    rating: 5,
    feedback: null,
    route: "google",
    contact_name: "Jane Doe",
    contact_email: "jane@example.com",
    campaign_id: "uuid",
    campaign_name: "January Outreach",
    location_id: "uuid",
    location_name: "Downtown Branch",
    recipient_id: "uuid",
  },
  "review.created": {
    event: "review.created",
    occurred_at: "2025-01-01T12:00:00Z",
    organization_id: "uuid",
    review_id: "uuid",
    source: "google",
    external_id: "ChIJ...",
    author_name: "Alex Smith",
    rating: 4,
    text: "Great service, would recommend.",
    review_url: "https://...",
    review_date: "2025-01-01T11:00:00Z",
    location_id: "uuid",
    sentiment: "positive",
  },
  "feedback.received": {
    event: "feedback.received",
    occurred_at: "2025-01-01T12:00:00Z",
    organization_id: "uuid",
    rating: 2,
    feedback: "The wait time was too long.",
    contact_name: "Jane Doe",
    contact_email: "jane@example.com",
    campaign_id: "uuid",
    campaign_name: "January Outreach",
    location_id: "uuid",
    location_name: "Downtown Branch",
    recipient_id: "uuid",
  },
};

export default function Webhooks() {
  const { organizationId, canManageTeam } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; url: string; events: EventType[] }>({ name: "", url: "", events: ["rating.submitted"] });
  const [sampleEvent, setSampleEvent] = useState<EventType>("rating.submitted");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ endpointId: string; secret: string } | null>(null);

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ["webhook_endpoints", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_webhook_endpoints", {
        _org_id: organizationId!,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });




  const createMut = useMutation({
    mutationFn: async () => {
      const baseSchema = z.object({
        name: z.string().trim().min(1).max(80),
        url: z.string().trim().url("Must be a valid HTTPS URL").startsWith("https://", "URL must start with https://"),
      });
      const parsed = baseSchema.safeParse({ name: form.name, url: form.url });
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
      if (form.events.length === 0) throw new Error("Select at least one event to subscribe to");

      const created: Array<{ id: string; signing_secret: string; event_type: string }> = [];
      for (const ev of form.events) {
        const suffix = form.events.length > 1 ? ` · ${ev}` : "";
        const { data, error } = await supabase.rpc("create_webhook_endpoint", {
          _org_id: organizationId!,
          _name: `${parsed.data.name}${suffix}`.slice(0, 80),
          _url: parsed.data.url,
          _event_type: ev,
        });
        if (error) throw error;
        const row = data?.[0];
        if (row) created.push(row);
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(created.length > 1 ? `${created.length} webhooks created` : "Webhook created");
      setOpen(false);
      setForm({ name: "", url: "", events: ["rating.submitted"] });
      // Reveal the secret only when a single endpoint was created (one shared secret per endpoint).
      if (created.length === 1 && created[0]?.id && created[0]?.signing_secret) {
        setRevealedSecret({ endpointId: created[0].id, secret: created[0].signing_secret });
      }
      qc.invalidateQueries({ queryKey: ["webhook_endpoints", organizationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("webhook_endpoints").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook_endpoints", organizationId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook deleted");
      qc.invalidateQueries({ queryKey: ["webhook_endpoints", organizationId] });
    },
  });

  const rotateMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("rotate_webhook_secret", {
        _endpoint_id: id,
      });
      if (error) throw error;
      return { id, secret: data };
    },
    onSuccess: ({ id, secret }) => {
      toast.success("Secret rotated");
      if (secret) {
        setRevealedSecret({ endpointId: id, secret });
      }
      qc.invalidateQueries({ queryKey: ["webhook_endpoints", organizationId] });
    },
  });

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (!canManageTeam) {
    return (
      <DashboardLayout title="Webhooks">
        <div className="p-8">
          <Card>
            <CardHeader>
              <CardTitle>Restricted</CardTitle>
              <CardDescription>Only owners and admins can manage webhooks.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Webhooks">
      <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Webhook className="h-6 w-6" /> Webhooks & Zapier
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Send rating events to Zapier, Make, n8n, or any HTTPS endpoint.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Add webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New webhook</DialogTitle>
                <DialogDescription>
                  Paste your Zapier "Catch Hook" URL or any HTTPS endpoint. We'll POST a JSON payload whenever the selected event fires.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="wh-name">Name</Label>
                  <Input id="wh-name" placeholder="Zapier — Slack alerts" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wh-url">Endpoint URL</Label>
                  <Input id="wh-url" placeholder="https://hooks.zapier.com/hooks/catch/..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="rounded-md border divide-y">
                    {EVENT_OPTIONS.map((opt) => {
                      const checked = form.events.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          htmlFor={`wh-evt-${opt.value}`}
                          className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/40"
                        >
                          <Checkbox
                            id={`wh-evt-${opt.value}`}
                            checked={checked}
                            onCheckedChange={(c) => {
                              setForm((prev) => ({
                                ...prev,
                                events: c
                                  ? Array.from(new Set([...prev.events, opt.value]))
                                  : prev.events.filter((e) => e !== opt.value),
                              }));
                            }}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col">
                            <span className="font-mono text-xs">{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecting multiple events creates one endpoint per event (each gets its own signing secret).
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endpoints</CardTitle>
            <CardDescription>
              Subscribe to <code className="text-xs px-1 py-0.5 rounded bg-muted">rating.submitted</code>, <code className="text-xs px-1 py-0.5 rounded bg-muted">review.created</code>, or <code className="text-xs px-1 py-0.5 rounded bg-muted">feedback.received</code>. Failed deliveries retry up to 4 times with backoff.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !endpoints?.length ? (
              <EmptyState
                icon={Webhook}
                title="No webhooks yet"
                description="Add a webhook endpoint to receive real-time events when ratings are submitted, so you can trigger automations in your own systems."
              />
            ) : (
              <div className="space-y-3">
                {endpoints.map((ep) => (
                  <div key={ep.id} className="border rounded-md p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{ep.name}</span>
                          <Badge variant={ep.is_active ? "default" : "secondary"}>{ep.is_active ? "Active" : "Paused"}</Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">{ep.event_type}</Badge>
                        </div>
                        <a href={ep.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground truncate block mt-1 hover:text-foreground inline-flex items-center gap-1">
                          {ep.url} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={ep.is_active} onCheckedChange={(v) => toggleMut.mutate({ id: ep.id, is_active: v })} />
                        <Button variant="ghost" size="icon" onClick={() => rotateMut.mutate(ep.id)} title="Rotate secret">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this webhook?")) deleteMut.mutate(ep.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {revealedSecret?.endpointId === ep.id ? (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Signing secret — copy and store it now</Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs px-2 py-1.5 rounded bg-muted font-mono truncate">{revealedSecret.secret}</code>
                          <Button variant="outline" size="sm" onClick={() => copy(revealedSecret.secret, ep.id)}>
                            {copiedId === ep.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Signing secret is hidden after creation. Rotate to generate a new one-time secret.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {organizationId && (
          <WebhookDeliveriesTable organizationId={organizationId} endpoints={endpoints} />
        )}



        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg">Sample payload</CardTitle>
                <CardDescription>Each request is POSTed with these headers: <code className="text-xs">X-MS-Event</code>, <code className="text-xs">X-MS-Signature</code>, <code className="text-xs">X-MS-Delivery-Id</code>.</CardDescription>
              </div>
              <Select value={sampleEvent} onValueChange={(v) => setSampleEvent(v as EventType)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">{JSON.stringify(SAMPLE_PAYLOADS[sampleEvent], null, 2)}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick-start: connect to Zapier or Make.com</CardTitle>
            <CardDescription>
              Forward Review Defender events to 5,000+ apps in under 5 minutes — no code required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <section className="space-y-2">
              <h3 className="font-semibold text-base">1. Pick the event you want to react to</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><code className="text-xs">rating.submitted</code> — fires the moment a customer rates a campaign (1–5★).</li>
                <li><code className="text-xs">review.created</code> — fires when a new public review is ingested from Google, Yelp, etc.</li>
                <li><code className="text-xs">feedback.received</code> — fires when a low rating triggers private feedback capture.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-base">2. Zapier setup</h3>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>In Zapier, create a new Zap and choose <strong>Webhooks by Zapier → Catch Hook</strong> as the trigger.</li>
                <li>Copy the unique webhook URL Zapier generates.</li>
                <li>Back in Review Defender, click <strong>New Endpoint</strong> above, paste the URL, pick the event, and save.</li>
                <li>Copy the <strong>signing secret</strong> shown once and store it in your Zap (used to verify <code className="text-xs">X-MS-Signature</code>).</li>
                <li>Trigger a test event (submit a sample rating) — Zapier will catch the payload and you can map fields to any downstream app.</li>
              </ol>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-base">3. Make.com setup</h3>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Create a new scenario and add the <strong>Webhooks → Custom webhook</strong> module.</li>
                <li>Click <strong>Add</strong>, name it <em>Review Defender</em>, and copy the generated address.</li>
                <li>Paste it into a new endpoint here, pick the event type, and save.</li>
                <li>Hit <strong>Re-determine data structure</strong> in Make, then send a test event from Review Defender so Make can learn the JSON shape.</li>
                <li>Chain any Make modules (Slack, Sheets, HubSpot, etc.) downstream.</li>
              </ol>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-base">4. Verifying the signature (recommended)</h3>
              <p className="text-muted-foreground">
                Every request is signed with HMAC-SHA256 of the raw body using your signing secret.
                Compare the <code className="text-xs">X-MS-Signature</code> header (format <code className="text-xs">sha256=…</code>) against your own
                computation — drop any request that doesn't match. Zapier/Make can do this with a small Code step.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-base">5. Troubleshooting</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Watch the <strong>Recent deliveries</strong> table below — failed attempts retry automatically (1m, 5m, 30m, 2h).</li>
                <li>If everything shows <code className="text-xs">failed: Org plan does not include the Webhooks feature</code>, your subscription was downgraded — re-upgrade to Premium or Founder.</li>
                <li>Local URLs (<code className="text-xs">localhost</code>, private IPs) are blocked by our SSRF guard. Use a public HTTPS endpoint.</li>
              </ul>
            </section>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
