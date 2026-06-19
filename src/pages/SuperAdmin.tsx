import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Rocket, Building2, Trash2, DollarSign, Wallet, BarChart3, RefreshCw, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StripePricesCard } from "@/components/StripePricesCard";

type OrgCostRow = {
  id: string;
  name: string;
  primaryColor: string | null;
  createdAt: string;
  planTier: "founder" | "starter" | "pro" | null;
  subscriptionStatus: string | null;
  revenueMonthly: number;
  estimatedCostMonthly: number;
  grossMarginMonthly: number;
  usage: {
    members: number;
    locations: number;
    syncedLocations: number;
    contacts: number;
    smsThisMonth: number;
    reviewsTotal: number;
    webhookDeliveries30d: number;
  };
  costBreakdown: {
    platformBaseCost: number;
    smsCostMonthly: number;
    reviewSyncCostMonthly: number;
    webhookCostMonthly: number;
    paymentFeesMonthly: number;
    estimatedReviewSyncRunsMonthly: number;
  };
};

type OrgCostResponse = {
  generatedAt: string;
  assumptions: {
    notes: string[];
  };
  organizations: OrgCostRow[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatPlan(plan: OrgCostRow["planTier"]) {
  return plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)}` : "No plan";
}

export default function SuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["admin_orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, primary_color, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: costData, isLoading: costLoading } = useQuery({
    queryKey: ["admin_org_costs"],
    queryFn: async (): Promise<OrgCostResponse> => {
      const { data, error } = await supabase.functions.invoke("admin-org-costs");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as OrgCostResponse;
    },
    enabled: !!isAdmin,
  });

  const { data: catalog, isLoading: catalogLoading, refetch: refetchCatalog, isFetching: catalogFetching } = useQuery({
    queryKey: ["admin_stripe_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-stripe-catalog");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        generatedAt: string;
        catalog: Record<string, Array<{
          id: string; name: string; description: string | null; plan_tier: string | null;
          metadata: Record<string, string>;
          prices: Array<{ id: string; lookup_key: string | null; nickname: string | null; unit_amount: number | null; currency: string; recurring: { interval: string; interval_count: number } | null }>;
        }>>;
        errors: Record<string, string>;
      };
    },
    enabled: !!isAdmin,
  });

  type FounderSlotRow = {
    slot_number: number;
    organization_id: string | null;
    organization_name: string | null;
    user_id: string | null;
    user_email: string | null;
    claimed_at: string | null;
    subscription_status: string | null;
    cancel_at_period_end: boolean | null;
    current_period_end: string | null;
    environment: string | null;
  };

  const { data: founderSlots, isLoading: founderLoading } = useQuery({
    queryKey: ["admin_founder_slots"],
    queryFn: async (): Promise<FounderSlotRow[]> => {
      const { data, error } = await supabase.rpc("list_founder_slots_admin");
      if (error) throw error;
      return (data ?? []) as FounderSlotRow[];
    },
    enabled: !!isAdmin,
  });

  const allSlots: (FounderSlotRow | { slot_number: number; empty: true })[] = Array.from(
    { length: 10 },
    (_, i) => {
      const n = i + 1;
      const found = founderSlots?.find((s) => s.slot_number === n);
      return found ?? { slot_number: n, empty: true as const };
    },
  );

  const statusBadge = (row: FounderSlotRow) => {
    const s = row.subscription_status;
    if (!s) return <Badge variant="outline">No subscription</Badge>;
    if (s === "active" || s === "trialing") {
      return row.cancel_at_period_end ? (
        <Badge variant="secondary">Active · cancels at period end</Badge>
      ) : (
        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30">Active</Badge>
      );
    }
    if (s === "canceled" || s === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
    if (s === "past_due" || s === "unpaid") return <Badge variant="destructive">{s.replace("_", " ")}</Badge>;
    return <Badge variant="outline">{s.replace("_", " ")}</Badge>;
  };

  const [form, setForm] = useState({ name: "", primary_color: "#3B82F6" });

  const costRows = costData?.organizations ?? [];
  const totals = costRows.reduce(
    (acc, org) => {
      acc.revenue += org.revenueMonthly;
      acc.cost += org.estimatedCostMonthly;
      acc.margin += org.grossMarginMonthly;
      return acc;
    },
    { revenue: 0, cost: 0, margin: 0 },
  );

  const createOrg = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_organization", {
        _name: form.name,
        _primary_color: form.primary_color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Organization Created", description: `${form.name} is live.` });
      setForm({ name: "", primary_color: "#3B82F6" });
      queryClient.invalidateQueries({ queryKey: ["admin_orgs"] });
      queryClient.invalidateQueries({ queryKey: ["user_organizations"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteOrg = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc("delete_organization", { _org_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Organization removed." });
      queryClient.invalidateQueries({ queryKey: ["admin_orgs"] });
      queryClient.invalidateQueries({ queryKey: ["user_organizations"] });
    },
    onError: (e: any) => {
      toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !roleLoading && user && isAdmin === false) {
      toast({ title: "Access Denied", description: "Admin privileges required", variant: "destructive" });
      navigate("/", { replace: true });
    }
  }, [authLoading, roleLoading, user, isAdmin, navigate, toast]);

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout title="Super Admin">
        <Skeleton className="h-32 w-full" />
      </DashboardLayout>
    );
  }
  if (!isAdmin) return null;

  return (
    <DashboardLayout title="Super Admin">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">Agency Command Center</h2>
            <p className="text-sm text-muted-foreground">Manage all client organizations</p>
          </div>
          <Button
            onClick={() => navigate("/super-admin/demo")}
            className="bg-gradient-to-r from-primary to-accent"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Launch Founder Demo
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              <CardTitle>Create Organization</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Spin up a new client workspace</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Co." />
              </div>
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" />
                  <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="font-mono text-sm" />
                </div>
              </div>
            </div>
            <Button onClick={() => createOrg.mutate()} disabled={!form.name.trim() || createOrg.isPending}>
              <Rocket className="h-4 w-4 mr-2" />
              {createOrg.isPending ? "Creating..." : "Create"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle>Organization Cost Dashboard</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Estimated monthly spend and margin by organization based on tracked usage and plan footprint.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {costLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="h-4 w-4" /> Monthly revenue
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{currency.format(totals.revenue)}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" /> Estimated monthly cost
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{currency.format(totals.cost)}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-4 w-4" /> Estimated monthly margin
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{currency.format(totals.margin)}</div>
                  </div>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Estimated cost</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Usage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costRows.length > 0 ? (
                        costRows.map((org) => (
                          <TableRow key={org.id}>
                            <TableCell className="font-medium text-foreground">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: org.primaryColor || "#3B82F6" }} />
                                  <span>{org.name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {org.subscriptionStatus ? org.subscriptionStatus.replace("_", " ") : "inactive"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatPlan(org.planTier)}</TableCell>
                            <TableCell className="text-right font-medium">{currency.format(org.revenueMonthly)}</TableCell>
                            <TableCell className="text-right">{currency.format(org.estimatedCostMonthly)}</TableCell>
                            <TableCell className="text-right">{currency.format(org.grossMarginMonthly)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              <div>SMS: {org.usage.smsThisMonth}</div>
                              <div>Locations: {org.usage.locations}</div>
                              <div>Synced: {org.usage.syncedLocations}</div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No organizations available for cost reporting yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {costData?.assumptions.notes.map((note) => (
                    <p key={note}>• {note}</p>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle>Founder Slots</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              All 10 founder spots and their current subscription status.
            </p>
          </CardHeader>
          <CardContent>
            {founderLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Env</TableHead>
                      <TableHead className="text-right">Claimed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSlots.map((slot) => {
                      if ("empty" in slot) {
                        return (
                          <TableRow key={slot.slot_number}>
                            <TableCell className="font-mono text-muted-foreground">{slot.slot_number}</TableCell>
                            <TableCell colSpan={5} className="text-sm text-muted-foreground italic">
                              Open
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return (
                        <TableRow key={slot.slot_number}>
                          <TableCell className="font-mono">{slot.slot_number}</TableCell>
                          <TableCell className="font-medium text-foreground">
                            {slot.organization_name ?? <span className="text-muted-foreground italic">deleted org</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {slot.user_email ?? "—"}
                          </TableCell>
                          <TableCell>{statusBadge(slot)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {slot.environment ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {slot.claimed_at ? new Date(slot.claimed_at).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <StripePricesCard
          catalog={catalog}
          loading={catalogLoading}
          fetching={catalogFetching}
          onSync={() => refetchCatalog()}
        />


        <Card>
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            {orgsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs && orgs.length > 0 ? (
                      orgs.map((org) => (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {org.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: org.primary_color || "#3B82F6" }} />
                              <span className="text-xs font-mono text-muted-foreground">{org.primary_color}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {new Date(org.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{org.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently removes the organization, all memberships, and all profiles linked to it. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteOrg.mutate(org.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No organizations yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
