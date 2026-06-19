import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Mail, Shield, Crown, Eye, User as UserIcon, Copy, Check } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUsage, parsePlanLimitError, type ResourceKey } from "@/hooks/useUsage";
import { UpgradePromptDialog } from "@/components/UpgradePromptDialog";
import { UsageBanner } from "@/components/UsageBanner";

type Role = "owner" | "admin" | "member" | "viewer";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "member", "viewer"]),
  location_ids: z.array(z.string().uuid()),
});

const roleMeta: Record<Role, { label: string; icon: typeof Shield; color: string; desc: string }> = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-500", desc: "Full control, billing, can delete org" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-500", desc: "Manage team & all locations" },
  member: { label: "Member", icon: UserIcon, color: "text-emerald-500", desc: "Edit assigned locations" },
  viewer: { label: "Viewer", icon: Eye, color: "text-slate-400", desc: "Read-only on assigned locations" },
};

export default function Team() {
  const { organizationId, organization, currentRole } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; role: "admin" | "member" | "viewer"; location_ids: string[] }>({
    email: "",
    role: "member",
    location_ids: [],
  });
  const { refetch: refetchUsage, isAtLimit } = useUsage();
  const [upgradePrompt, setUpgradePrompt] = useState<{
    open: boolean;
    resource: ResourceKey;
    used?: number;
    limit?: number;
    noSubscription?: boolean;
  }>({ open: false, resource: "seats" });

  const canManage = currentRole === "owner" || (currentRole as string) === "admin";

  const { data: members = [] } = useQuery({
    queryKey: ["team_members", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select("id, user_id, role, created_at, profiles:user_id(full_name)")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["team_invites", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invitations")
        .select("id, email, role, location_ids, created_at, expires_at, accepted_at")
        .eq("organization_id", organizationId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && canManage,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_all", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: locationAccessByUser = {} } = useQuery({
    queryKey: ["loc_access", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_location_access")
        .select("user_id, location_id")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      data?.forEach((r) => {
        map[r.user_id] = [...(map[r.user_id] ?? []), r.location_id];
      });
      return map;
    },
    enabled: !!organizationId && canManage,
  });

  const inviteMut = useMutation({
    mutationFn: async () => {
      const parsed = inviteSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
      if ((parsed.data.role === "member" || parsed.data.role === "viewer") && parsed.data.location_ids.length === 0) {
        throw new Error("Select at least one location for member/viewer roles");
      }
      const { data, error } = await supabase
        .from("team_invitations")
        .insert({
          organization_id: organizationId!,
          email: parsed.data.email.toLowerCase(),
          role: parsed.data.role,
          location_ids: parsed.data.role === "admin" ? [] : parsed.data.location_ids,
          invited_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { data: inviteToken, error: tokenError } = await supabase.rpc("issue_team_invitation_token", {
        _invitation_id: data.id,
      });
      if (tokenError || !inviteToken) throw tokenError ?? new Error("Failed to generate invitation link");

      // Send email
      const acceptUrl = `${window.location.origin}/invite/${inviteToken}`;
      const o = organization as any;
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "team-invitation",
          recipientEmail: parsed.data.email,
          idempotencyKey: `invite-${data.id}`,
          fromName: o?.email_from_name || o?.name,
          templateData: {
            inviterName: user?.email?.split("@")[0],
            organizationName: o?.name,
            organizationLogoUrl: o?.logo_url ?? undefined,
            brandColor: o?.primary_color ?? undefined,
            supportEmail: o?.support_email ?? undefined,
            footerText: o?.email_footer_text ?? undefined,
            role: parsed.data.role,
            acceptUrl,
          },
        },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_invites", organizationId] });
      refetchUsage();
      toast.success("Invitation sent");
      setInviteOpen(false);
      setForm({ email: "", role: "member", location_ids: [] });
    },
    onError: (e: Error) => {
      const parsed = parsePlanLimitError(e);
      if (parsed) {
        setInviteOpen(false);
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

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_invites", organizationId] });
      toast.success("Invitation revoked");
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ membershipId, role }: { membershipId: string; role: Role }) => {
      const { error } = await supabase.from("user_organizations").update({ role }).eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", organizationId] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.from("user_organizations").delete().eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", organizationId] });
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async (invitationId: string) => {
    const { data: token, error } = await supabase.rpc("issue_team_invitation_token", {
      _invitation_id: invitationId,
    });
    if (error || !token) {
      toast.error(error?.message ?? "Failed to generate invitation link");
      return;
    }

    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(invitationId);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleLoc = (id: string) => {
    setForm((f) => ({
      ...f,
      location_ids: f.location_ids.includes(id)
        ? f.location_ids.filter((x) => x !== id)
        : [...f.location_ids, id],
    }));
  };

  if (!canManage) {
    return (
      <DashboardLayout title="Team">
        <div className="max-w-2xl mx-auto py-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-xl font-semibold">Owner or Admin access required</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Ask an organization owner or admin for access to the team page.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Team">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground mt-1">
              Invite teammates and control who can see and edit which locations.
            </p>
          </div>
          <Button
            onClick={() => {
              if (isAtLimit("seats")) {
                setUpgradePrompt({ open: true, resource: "seats" });
                return;
              }
              setInviteOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Invite member
          </Button>
        </div>

        <UsageBanner resource="seats" label="Team seats" />

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members ({members.length})</CardTitle>
            <CardDescription>People with access to this organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m: any) => {
              const meta = roleMeta[(m.role as Role) ?? "member"];
              const Icon = meta.icon;
              const isSelf = m.user_id === user?.id;
              const accessIds: string[] = locationAccessByUser[m.user_id] ?? [];
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {m.profiles?.full_name || "Team member"}
                      </span>
                      {isSelf && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                    </div>
                    {(m.role === "member" || m.role === "viewer") && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {accessIds.length === 0
                          ? "No locations assigned"
                          : `${accessIds.length} location${accessIds.length > 1 ? "s" : ""}`}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="gap-1 shrink-0">
                    <Icon className={`h-3 w-3 ${meta.color}`} />
                    {meta.label}
                  </Badge>
                  {!isSelf && m.role !== "owner" && currentRole === "owner" && (
                    <Select
                      value={m.role}
                      onValueChange={(v: Role) => updateRole.mutate({ membershipId: m.id, role: v })}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {!isSelf && m.role !== "owner" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Remove this member from the organization?")) {
                          removeMember.mutate(m.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Pending invites */}
        {invites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending invitations ({invites.length})</CardTitle>
              <CardDescription>Awaiting acceptance — link expires in 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {invites.map((inv: any) => {
                const meta = roleMeta[inv.role as Role];
                const Icon = meta.icon;
                return (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.location_ids?.length
                          ? `${inv.location_ids.length} location${inv.location_ids.length > 1 ? "s" : ""}`
                          : "All locations"}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Icon className={`h-3 w-3 ${meta.color}`} /> {meta.label}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => copyLink(inv.id)}>
                      {copied === inv.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => revokeInvite.mutate(inv.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>They'll receive an email with a link to join.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="teammate@example.com"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["admin", "member", "viewer"] as const).map((r) => {
                    const m = roleMeta[r];
                    const Icon = m.icon;
                    return (
                      <SelectItem key={r} value={r}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${m.color}`} />
                          <span>{m.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">{roleMeta[form.role].desc}</p>
            </div>
            {(form.role === "member" || form.role === "viewer") && (
              <div>
                <Label>Locations</Label>
                {locations.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    No locations exist yet. Add some in the Locations page first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {locations.map((l) => {
                      const sel = form.location_ids.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => toggleLoc(l.id)}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                            sel
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card hover:bg-muted border-border"
                          }`}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => inviteMut.mutate()} disabled={inviteMut.isPending}>
              {inviteMut.isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradePromptDialog
        open={upgradePrompt.open}
        onOpenChange={(v) => setUpgradePrompt((p) => ({ ...p, open: v }))}
        resource={upgradePrompt.resource}
        used={upgradePrompt.used}
        limit={upgradePrompt.limit}
        noSubscription={upgradePrompt.noSubscription}
      />
    </DashboardLayout>
  );
}
