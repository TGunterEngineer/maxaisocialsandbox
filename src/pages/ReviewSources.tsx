import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Copy, KeyRound, Plus, Trash2, Webhook, ArrowRight } from "lucide-react";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Integration = {
  platform: Platform;
  title: string;
  description: string;
  cta: string;
  status: "available" | "coming-soon";
};

const INTEGRATIONS: Integration[] = [
  {
    platform: "google",
    title: "Google Business Profile",
    description: "Automatically sync your public customer reviews from Google.",
    cta: "Connect Account",
    status: "available",
  },
  {
    platform: "facebook",
    title: "Facebook Pages",
    description: "Pull in recommendations and ratings from your Facebook page.",
    cta: "Connect Account",
    status: "available",
  },
  {
    platform: "yelp",
    title: "Yelp",
    description: "Keep an eye on every new Yelp review as soon as it goes live.",
    cta: "Configure Sync",
    status: "coming-soon",
  },
];

export default function ReviewSources() {
  const { organizationId, canManageTeam } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["review_ingest_keys", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_ingest_keys")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && developerMode,
  });

  const createKey = async () => {
    if (!organizationId || !user) return;
    if (!name.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    const { error } = await supabase.from("review_ingest_keys").insert({
      organization_id: organizationId, name: name.trim().slice(0, 100), created_by: user.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ingest key created");
    setName("");
    qc.invalidateQueries({ queryKey: ["review_ingest_keys", organizationId] });
  };

  const revokeKey = async (id: string) => {
    const { error } = await supabase.from("review_ingest_keys").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Key revoked");
    qc.invalidateQueries({ queryKey: ["review_ingest_keys", organizationId] });
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const handleConnect = (integration: Integration) => {
    if (integration.status === "coming-soon") {
      toast.info(`${integration.title} integration is coming soon.`);
      return;
    }
    toast.success(`Starting ${integration.title} connection...`);
  };

  const ingestUrl = `${SUPABASE_URL}/functions/v1/ingest-review`;

  return (
    <DashboardLayout title="Review Sources">
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-end gap-3 rounded-lg border bg-card p-4">
          <Label htmlFor="developer-mode" className="text-sm font-medium text-foreground">
            Developer Mode
          </Label>
          <Switch
            id="developer-mode"
            checked={developerMode}
            onCheckedChange={setDeveloperMode}
          />
        </div>

        {!developerMode ? (
          <div className="space-y-2">
            <div className="px-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Connect your review platforms</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick a platform to start syncing reviews automatically. No technical setup required.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-3">
              {INTEGRATIONS.map((integration) => (
                <Card
                  key={integration.platform}
                  className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <CardHeader className="space-y-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
                        <div className="scale-[2.25]">
                          <PlatformIcon platform={integration.platform} showLabel={false} />
                        </div>
                      </div>
                      {integration.status === "coming-soon" && (
                        <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <CardTitle className="text-lg">{integration.title}</CardTitle>
                      <CardDescription className="leading-relaxed">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button
                      className="w-full"
                      variant={integration.status === "available" ? "default" : "outline"}
                      onClick={() => handleConnect(integration)}
                    >
                      {integration.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-primary" /> Webhook ingest</CardTitle>
                <CardDescription>
                  POST reviews to this endpoint from Zapier, Make, Outscraper, or your own scripts. Authenticate with an ingest key as the <code className="px-1 py-0.5 rounded bg-muted text-xs">x-ingest-key</code> header.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Endpoint</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-xs break-all">{ingestUrl}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(ingestUrl)}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sample payload</Label>
                  <pre className="mt-1 rounded bg-muted p-3 text-xs overflow-x-auto">{`{
  "source": "google",
  "external_id": "abc123",
  "author_name": "Jane Doe",
  "rating": 5,
  "text": "Loved it!",
  "review_url": "https://...",
  "review_date": "2025-04-23T10:00:00Z"
}`}</pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Send a single object or an array. Valid sources: google, facebook, instagram, yelp, trustpilot, manual, webhook, outscraper, other.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Ingest keys</CardTitle>
                <CardDescription>Create a key per integration so you can revoke them independently.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canManageTeam && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="key-name">Key name</Label>
                      <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier · Outscraper · etc." maxLength={100} />
                    </div>
                    <Button onClick={createKey} disabled={creating}><Plus className="h-4 w-4 mr-1" /> Create</Button>
                  </div>
                )}

                <div className="space-y-2">
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : (keys?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">No ingest keys yet.</p>
                  ) : (
                    keys!.map((k) => (
                      <div key={k.id} className="flex items-center gap-2 rounded-md border bg-card p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{k.name}</span>
                            {!k.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                          </div>
                          <code className="text-[11px] text-muted-foreground break-all">{k.key}</code>
                          {k.last_used_at && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">Last used {new Date(k.last_used_at).toLocaleString()}</p>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => copy(k.key)}><Copy className="h-3.5 w-3.5" /></Button>
                        {canManageTeam && (
                          <Button size="sm" variant="ghost" onClick={() => revokeKey(k.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Native source integrations</CardTitle>
            <CardDescription>Status of direct connections to review platforms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div><div className="font-medium">Google Business Profile</div><div className="text-xs text-muted-foreground">Coming via Outscraper integration</div></div>
              <Badge variant="outline">Planned</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div><div className="font-medium">Facebook Pages</div><div className="text-xs text-muted-foreground">Per-merchant OAuth</div></div>
              <Badge variant="outline">Planned</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div><div className="font-medium">Manual entry & CSV import</div><div className="text-xs text-muted-foreground">Available now from the dashboard</div></div>
              <Badge>Active</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div><div className="font-medium">Webhook ingest API</div><div className="text-xs text-muted-foreground">For Zapier, Make, Outscraper, custom scripts</div></div>
              <Badge>Active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
