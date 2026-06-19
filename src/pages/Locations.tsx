import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, MapPin, Trash2, QrCode, Star, Edit2, Code2, RefreshCw } from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUsage, parsePlanLimitError, type ResourceKey } from "@/hooks/useUsage";
import { UpgradePromptDialog } from "@/components/UpgradePromptDialog";
import { UsageBanner } from "@/components/UsageBanner";
import { EmptyState } from "@/components/EmptyState";
import { EmbedWidgetDialog } from "@/components/EmbedWidgetDialog";
import { LocationQrDialog } from "@/components/LocationQrDialog";

const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  google_review_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  is_primary: z.boolean(),
});

type Location = {
  id: string;
  name: string;
  address: string | null;
  google_review_url: string | null;
  is_primary: boolean;
  created_at: string;
  last_synced_at: string | null;
};

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const emptyForm = { name: "", address: "", google_review_url: "", is_primary: false };

export default function Locations() {
  const { organizationId, organization } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [qrLocation, setQrLocation] = useState<Location | null>(null);
  const [embedLocation, setEmbedLocation] = useState<Location | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { refetch: refetchUsage, isAtLimit } = useUsage();
  const [upgradePrompt, setUpgradePrompt] = useState<{
    open: boolean;
    resource: ResourceKey;
    used?: number;
    limit?: number;
    noSubscription?: boolean;
  }>({ open: false, resource: "locations" });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Location[];
    },
    enabled: !!organizationId,
  });

  const upsertMut = useMutation({
    mutationFn: async () => {
      const parsed = locationSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
      }
      const payload = {
        organization_id: organizationId!,
        name: parsed.data.name,
        address: parsed.data.address || null,
        google_review_url: parsed.data.google_review_url || null,
        is_primary: parsed.data.is_primary,
      };

      if (parsed.data.is_primary) {
        // Demote other primaries first
        await supabase
          .from("locations")
          .update({ is_primary: false })
          .eq("organization_id", organizationId!)
          .neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000");
      }

      if (editing) {
        const { error } = await supabase.from("locations").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations", organizationId] });
      refetchUsage();
      toast.success(editing ? "Location updated" : "Location added");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => {
      const parsed = parsePlanLimitError(e);
      if (parsed) {
        setOpen(false);
        setUpgradePrompt({
          open: true,
          resource: parsed.resource as ResourceKey,
          used: parsed.used,
          limit: parsed.limit,
          noSubscription: parsed.noSubscription,
        });
        return;
      }
      toast.error(e.message);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations", organizationId] });
      toast.success("Location deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: refreshQuota } = useQuery({
    queryKey: ["manual_refresh_quota", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_manual_refresh_quota", {
        _org_id: organizationId!,
      });
      if (error) throw error;
      return data as { plan: string | null; used: number; limit: number | null; allowed: boolean };
    },
    enabled: !!organizationId,
    refetchInterval: 60_000,
  });

  const refreshAtLimit = refreshQuota ? refreshQuota.allowed === false : false;

  const syncMut = useMutation({
    mutationFn: async (locationId: string) => {
      if (refreshAtLimit) {
        throw new Error("quota_exceeded");
      }
      setSyncingId(locationId);
      const { data, error } = await supabase.functions.invoke("sync-outscraper-reviews", {
        body: { location_id: locationId, limit: 50, sort: "newest" },
      });
      if (error) throw new Error(error.message);
      const d = data as any;
      if (d?.error === "quota_exceeded") throw new Error("quota_exceeded");
      if (d?.error) throw new Error(d.error);
      return d as { inserted: number; fetched: number; location: string; cached?: boolean };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["reviews", organizationId] });
      qc.invalidateQueries({ queryKey: ["locations", organizationId] });
      qc.invalidateQueries({ queryKey: ["manual_refresh_quota", organizationId] });
      if (res?.cached) {
        toast.info(`Serving cached reviews for ${res?.location ?? "location"} (synced within the last 24h)`);
      } else {
        toast.success(`Synced ${res?.inserted ?? 0} new reviews from Google for ${res?.location ?? "location"}`);
      }
    },
    onError: (e: Error) => {
      if (e.message === "quota_exceeded") {
        toast("Daily refresh limit reached for your plan. Automatic background syncing will handle your next update.");
        qc.invalidateQueries({ queryKey: ["manual_refresh_quota", organizationId] });
      } else {
        toast.error(e.message);
      }
    },
    onSettled: () => setSyncingId(null),
  });


  const openEdit = (loc: Location) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      address: loc.address ?? "",
      google_review_url: loc.google_review_url ?? "",
      is_primary: loc.is_primary,
    });
    setOpen(true);
  };

  const openNew = () => {
    if (isAtLimit("locations")) {
      setUpgradePrompt({ open: true, resource: "locations" });
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  return (
    <DashboardLayout title="Locations">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
            <p className="text-muted-foreground mt-1">
              Manage each branch, storefront, or service area for this organization.
            </p>
          </div>
          <Button onClick={openNew} disabled={!organizationId}>
            <Plus className="h-4 w-4 mr-2" />
            Add location
          </Button>
        </div>

        <UsageBanner resource="locations" label="Locations" />

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        ) : locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            description="Add your first storefront, branch, or service area. Each location can have its own Google review URL so reviews route to the right page."
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" /> Add your first location
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {locations.map((loc) => (
              <Card key={loc.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{loc.name}</span>
                      </CardTitle>
                      {loc.address && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {loc.address}
                        </CardDescription>
                      )}
                    </div>
                    {loc.is_primary && (
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <Star className="h-3 w-3" /> Primary
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {loc.google_review_url ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground truncate">
                        Google: <span className="text-foreground">{loc.google_review_url}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loc.last_synced_at
                          ? <>Last synced <span className="text-foreground">{relativeTime(loc.last_synced_at)}</span></>
                          : <span className="italic">Never synced</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No Google review URL set — campaigns will use the default URL.
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(loc)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQrLocation(loc)}
                      disabled={!loc.google_review_url}
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEmbedLocation(loc)}
                    >
                      <Code2 className="h-3.5 w-3.5 mr-1.5" /> Embed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncMut.mutate(loc.id)}
                      disabled={!loc.google_review_url || refreshAtLimit || (syncMut.isPending && syncingId === loc.id)}
                      title={
                        !loc.google_review_url
                          ? "Set a Google review URL first"
                          : refreshAtLimit
                            ? `Daily refresh limit reached (${refreshQuota?.used ?? 0}/${refreshQuota?.limit ?? 0})`
                            : "Fetch latest Google reviews via Outscraper"
                      }
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncMut.isPending && syncingId === loc.id ? "animate-spin" : ""}`} />
                      {syncMut.isPending && syncingId === loc.id ? "Syncing…" : "Sync Google"}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete ${loc.name}? Contacts/campaigns will be unassigned.`)) {
                          deleteMut.mutate(loc.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit dialog */}
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditing(null);
              setForm(emptyForm);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit location" : "Add location"}</DialogTitle>
              <DialogDescription>
                Each location can have its own Google review URL.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="loc-name">Name</Label>
                <Input
                  id="loc-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Downtown branch"
                />
              </div>
              <div>
                <Label htmlFor="loc-addr">Address (optional)</Label>
                <Input
                  id="loc-addr"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main St, Springfield"
                />
              </div>
              <div>
                <Label htmlFor="loc-url">Google review URL (optional)</Label>
                <Input
                  id="loc-url"
                  value={form.google_review_url}
                  onChange={(e) => setForm({ ...form, google_review_url: e.target.value })}
                  placeholder="https://g.page/r/..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
                  className="h-4 w-4"
                />
                Primary location (default for unassigned contacts)
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>
                {upsertMut.isPending ? "Saving…" : editing ? "Save changes" : "Add location"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR dialog */}
        <LocationQrDialog
          open={!!qrLocation}
          onOpenChange={(v) => !v && setQrLocation(null)}
          locationName={qrLocation?.name}
          googleReviewUrl={qrLocation?.google_review_url ?? undefined}
          organizationName={organization?.name}
          primaryColor={organization?.primary_color}
        />

        {/* Embed widget dialog */}
        {organizationId && (
          <EmbedWidgetDialog
            open={!!embedLocation}
            onOpenChange={(v) => !v && setEmbedLocation(null)}
            organizationId={organizationId}
            locationId={embedLocation?.id}
            locationName={embedLocation?.name}
          />
        )}

        <UpgradePromptDialog
          open={upgradePrompt.open}
          onOpenChange={(v) => setUpgradePrompt((p) => ({ ...p, open: v }))}
          resource={upgradePrompt.resource}
          used={upgradePrompt.used}
          limit={upgradePrompt.limit}
          noSubscription={upgradePrompt.noSubscription}
        />
      </div>
    </DashboardLayout>
  );
}
