import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { z } from "zod";
import Papa from "papaparse";
import { Upload, Trash2, UserPlus, MessageSquare, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useUsage, parsePlanLimitError, type ResourceKey } from "@/hooks/useUsage";
import { UpgradePromptDialog } from "@/components/UpgradePromptDialog";
import { UsageBanner } from "@/components/UsageBanner";
import { EmptyState } from "@/components/EmptyState";
import { Link } from "react-router-dom";

function escapeIlike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).toLowerCase(),
  phone: z.string().trim().max(40).optional().nullable(),
  sms_opt_in: z.boolean().optional(),
});

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location_id: string | null;
  sms_opt_in: boolean;
  created_at: string;
};

type LocationLite = { id: string; name: string };

export default function Contacts() {
  const { organizationId } = useOrganization();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { refetch: refetchUsage, isAtLimit } = useUsage();
  const [upgradePrompt, setUpgradePrompt] = useState<{
    open: boolean;
    resource: ResourceKey;
    used?: number;
    limit?: number;
    noSubscription?: boolean;
  }>({ open: false, resource: "contacts" });

  const handleLimitError = (err: unknown): boolean => {
    const parsed = parsePlanLimitError(err);
    if (parsed) {
      setUpgradePrompt({
        open: true,
        resource: parsed.resource as ResourceKey,
        used: parsed.used,
        limit: parsed.limit,
        noSubscription: parsed.noSubscription,
      });
      return true;
    }
    return false;
  };

  const CONTACTS_PAGE_SIZE = 20;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: contactsData,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["contacts", organizationId, { search: debouncedSearch, location: locationFilter }],
    enabled: !!organizationId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * CONTACTS_PAGE_SIZE;
      const to = from + CONTACTS_PAGE_SIZE - 1;
      let q = supabase
        .from("contacts")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (locationFilter === "unassigned") {
        q = q.is("location_id", null);
      } else if (locationFilter !== "all") {
        q = q.eq("location_id", locationFilter);
      }
      if (debouncedSearch) {
        const pattern = `%${escapeIlike(debouncedSearch)}%`;
        q = q.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Contact[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < CONTACTS_PAGE_SIZE ? undefined : allPages.length,
  });
  const contacts = contactsData?.pages.flat() ?? [];

  const sentinelRef = useInfiniteScroll<HTMLTableRowElement>(
    () => {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    },
    { enabled: !!hasNextPage && !isFetchingNextPage },
  );

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-lite", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return data as LocationLite[];
    },
    enabled: !!organizationId,
  });

  const updateLocationMut = useMutation({
    mutationFn: async ({ id, location_id }: { id: string; location_id: string | null }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ location_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", organizationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSmsOptInMut = useMutation({
    mutationFn: async ({ id, sms_opt_in }: { id: string; sms_opt_in: boolean }) => {
      const { error } = await supabase
        .from("contacts")
        .update({
          sms_opt_in,
          sms_opted_in_at: sms_opt_in ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", organizationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", organizationId] });
      toast.success("Contact deleted");
    },
  });

  const handleCsvUpload = (file: File) => {
    if (!organizationId) return;
    setUploading(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: async (results) => {
        try {
          const rows = results.data;
          const valid: Array<{ organization_id: string; name: string; email: string; phone: string | null; sms_opt_in: boolean; sms_opted_in_at: string | null }> = [];
          const errors: string[] = [];
          const truthy = (v: string | undefined) => !!v && ["true", "1", "yes", "y"].includes(v.trim().toLowerCase());

          rows.forEach((row, idx) => {
            const optIn = truthy(row.sms_opt_in || row["sms opt in"] || row["sms"]);
            const parsed = contactSchema.safeParse({
              name: row.name || row["full name"] || row.fullname,
              email: row.email,
              phone: row.phone || row["phone number"] || null,
            });
            if (!parsed.success) {
              errors.push(`Row ${idx + 2}: ${parsed.error.errors[0]?.message ?? "invalid"}`);
              return;
            }
            valid.push({
              organization_id: organizationId,
              name: parsed.data.name,
              email: parsed.data.email,
              phone: parsed.data.phone || null,
              sms_opt_in: optIn,
              sms_opted_in_at: optIn ? new Date().toISOString() : null,
            });
          });

          if (valid.length === 0) {
            toast.error("No valid contacts found. Required columns: name, email");
            return;
          }

          // Upsert in batches of 500 to handle large CSVs
          const batches: typeof valid[] = [];
          for (let i = 0; i < valid.length; i += 500) batches.push(valid.slice(i, i + 500));

          let inserted = 0;
          for (const batch of batches) {
            const { error, count } = await supabase
              .from("contacts")
              .upsert(batch, { onConflict: "organization_id,email", count: "exact" });
            if (error) throw error;
            inserted += count ?? batch.length;
          }

          qc.invalidateQueries({ queryKey: ["contacts", organizationId] });
          refetchUsage();
          toast.success(`Imported ${inserted} contacts${errors.length ? ` (${errors.length} skipped)` : ""}`);
        } catch (e: any) {
          if (!handleLimitError(e)) toast.error(e.message ?? "Upload failed");
        } finally {
          setUploading(false);
          if (fileRef.current) fileRef.current.value = "";
        }
      },
      error: (err) => {
        toast.error(`CSV parse error: ${err.message}`);
        setUploading(false);
      },
    });
  };

  return (
    <DashboardLayout title="Contacts">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="text-muted-foreground mt-1">
              Customers you can invite to leave a review.
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsvUpload(f);
              }}
            />
            <Button
              onClick={() => {
                if (isAtLimit("contacts")) {
                  setUpgradePrompt({ open: true, resource: "contacts" });
                  return;
                }
                fileRef.current?.click();
              }}
              disabled={uploading || !organizationId}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading…" : "Upload CSV"}
            </Button>
          </div>
        </div>

        <UsageBanner resource="contacts" label="Contacts" />

        <Card>
          <CardHeader>
            <CardTitle>CSV format</CardTitle>
            <CardDescription>
              Required: <code className="text-foreground">name</code>,{" "}
              <code className="text-foreground">email</code>. Optional:{" "}
              <code className="text-foreground">phone</code>,{" "}
              <code className="text-foreground">sms_opt_in</code> (use <code>true</code>/<code>1</code>/<code>yes</code> to grant SMS consent). Duplicate emails are merged.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              All contacts{contacts.length ? ` (${contacts.length}${hasNextPage ? "+" : ""})` : ""}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, or phone…"
                  className="pl-8 h-9"
                />
              </div>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : contacts.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No contacts yet"
                description="Upload a CSV of your customers to start sending review requests. Required columns: name, email."
                action={
                  <>
                    <Button
                      onClick={() => {
                        if (isAtLimit("contacts")) {
                          setUpgradePrompt({ open: true, resource: "contacts" });
                          return;
                        }
                        fileRef.current?.click();
                      }}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Uploading…" : "Upload CSV"}
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/locations">Add a location first</Link>
                    </Button>
                  </>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center"><span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> SMS</span></TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        {c.phone ? (
                          <Switch
                            checked={c.sms_opt_in}
                            onCheckedChange={(v) => updateSmsOptInMut.mutate({ id: c.id, sms_opt_in: v })}
                            aria-label="SMS opt-in"
                          />
                        ) : (
                          <Badge variant="outline" className="text-[10px]">No phone</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {locations.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Select
                            value={c.location_id ?? "none"}
                            onValueChange={(v) =>
                              updateLocationMut.mutate({
                                id: c.id,
                                location_id: v === "none" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px]">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMut.mutate(c.id)}
                          aria-label="Delete contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow ref={sentinelRef} aria-hidden>
                    <TableCell colSpan={6} className="p-0 h-1" />
                  </TableRow>
                  {isFetchingNextPage && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  )}
                  {hasNextPage && !isFetchingNextPage && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                          Load more
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

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
