import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageSEO } from "@/components/PageSEO";
import { format, parseISO } from "date-fns";
import { z } from "zod";
import { Send, Plus, QrCode, Calendar, Users, MapPin, Mail, MessageSquare, Zap } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { A2pStatusBanner } from "@/components/A2pStatusBanner";
import { EmptyState } from "@/components/EmptyState";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  message_body: z.string().trim().min(10).max(2000),
  google_review_url: z.string().trim().url().max(500),
  scheduled_at: z.string().min(1),
  channel: z.enum(["email", "sms"]),
});

type Campaign = {
  id: string;
  name: string;
  subject: string;
  message_body: string;
  google_review_url: string | null;
  scheduled_at: string;
  status: string;
  channel: string;
  created_at: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "secondary",
  sending: "default",
  sent: "default",
  failed: "destructive",
  cancelled: "outline",
};

export default function Campaigns() {
  const { organizationId } = useOrganization();
  const { user } = useAuth();
  const { isSuperAdmin } = useIsSuperAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qrCampaign, setQrCampaign] = useState<Campaign | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    subject: "How was your experience?",
    message_body: "Thanks for choosing us! We'd love to hear how we did — it takes just 30 seconds.",
    google_review_url: "",
    scheduled_at: "",
    channel: "email" as "email" | "sms",
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!organizationId,
  });

  const { data: a2pStatus } = useQuery({
    queryKey: ["a2p-status", organizationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("a2p_registrations")
        .select("status")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      return (data?.status as string | undefined) ?? "none";
    },
    enabled: !!organizationId,
  });

  const smsBlocked = form.channel === "sms" && !isSuperAdmin && a2pStatus !== "approved";



  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-with-location", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, location_id, phone, sms_opt_in")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return data as Array<{ id: string; location_id: string | null; phone: string | null; sms_opt_in: boolean }>;
    },
    enabled: !!organizationId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-for-campaigns", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, google_review_url, is_primary")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string; google_review_url: string | null; is_primary: boolean }>;
    },
    enabled: !!organizationId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const parsed = campaignSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
      }
      // Filter contacts by selected locations (or all if none selected = whole org)
      let targetedContacts =
        selectedLocationIds.length === 0
          ? contacts
          : contacts.filter((c) => c.location_id && selectedLocationIds.includes(c.location_id));

      // For SMS, only contacts with a phone number AND opt-in
      if (parsed.data.channel === "sms") {
        if (!isSuperAdmin && a2pStatus !== "approved") {
          throw new Error("SMS launching is locked until A2P compliance is approved.");
        }
        targetedContacts = targetedContacts.filter((c) => c.phone && c.sms_opt_in);
      }

      if (targetedContacts.length === 0) {
        throw new Error(
          parsed.data.channel === "sms"
            ? "No contacts with a phone number and SMS opt-in match your filter."
            : selectedLocationIds.length > 0
              ? "No contacts are tagged to the selected locations."
              : "No contacts available. Upload contacts first.",
        );
      }

      const scheduledIso = new Date(parsed.data.scheduled_at).toISOString();

      // Create campaign
      const { data: camp, error: campErr } = await supabase
        .from("campaigns")
        .insert({
          organization_id: organizationId!,
          created_by: user!.id,
          name: parsed.data.name,
          subject: parsed.data.subject,
          message_body: parsed.data.message_body,
          google_review_url: parsed.data.google_review_url,
          scheduled_at: scheduledIso,
          status: "scheduled",
          channel: parsed.data.channel,
        })
        .select()
        .single();
      if (campErr) throw campErr;

      // Link selected locations to the campaign
      if (selectedLocationIds.length > 0) {
        const links = selectedLocationIds.map((lid) => ({
          campaign_id: camp.id,
          location_id: lid,
          organization_id: organizationId!,
        }));
        const { error: linkErr } = await supabase.from("campaign_locations").insert(links);
        if (linkErr) throw linkErr;
      }

      // Add filtered contacts as recipients, carrying their location forward
      const recipients = targetedContacts.map((c) => ({
        campaign_id: camp.id,
        contact_id: c.id,
        organization_id: organizationId!,
        location_id: c.location_id,
      }));
      const { error: recErr } = await supabase.from("campaign_recipients").insert(recipients);
      if (recErr) throw recErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", organizationId] });
      toast.success("Campaign scheduled");
      setOpen(false);
      setSelectedLocationIds([]);
      setForm({
        name: "",
        subject: "How was your experience?",
        message_body: "Thanks for choosing us! We'd love to hear how we did — it takes just 30 seconds.",
        google_review_url: "",
        scheduled_at: "",
        channel: "email",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", organizationId] });
      toast.success("Campaign cancelled");
    },
  });

  const sendNowMut = useMutation({
    mutationFn: async (id: string) => {
      // Bring scheduled_at to now so the cron picks it up,
      // and kick the dispatcher immediately for instant feedback.
      const { error: upErr } = await supabase
        .from("campaigns")
        .update({ scheduled_at: new Date().toISOString(), status: "scheduled" })
        .eq("id", id);
      if (upErr) throw upErr;
      const { error: invokeErr } = await supabase.functions.invoke("process-review-campaigns", {
        body: {},
      });
      if (invokeErr) throw invokeErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", organizationId] });
      toast.success("Sending now — recipients will receive messages shortly");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to send"),
  });

  return (
    <>
      <PageSEO title="Review Campaigns" description="Schedule and manage branded review request campaigns by email or SMS. Route happy customers to Google and unhappy ones to private feedback." />
      <DashboardLayout title="Review Campaigns">
        <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Review Campaigns</h1>
            <p className="text-muted-foreground mt-1">
              Send branded review requests to your customers on a schedule.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New review campaign</DialogTitle>
                <DialogDescription>
                  {selectedLocationIds.length === 0
                    ? `Will be sent to all ${contacts.length} contacts in this organization.`
                    : `Will be sent to ${contacts.filter((c) => c.location_id && selectedLocationIds.includes(c.location_id)).length} contacts at the selected location${selectedLocationIds.length > 1 ? "s" : ""}.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="name">Campaign name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="January post-purchase" />
                </div>

                <div>
                  <Label>Send via</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {(["email", "sms"] as const).map((ch) => {
                      const Icon = ch === "email" ? Mail : MessageSquare;
                      const active = form.channel === ch;
                      return (
                        <button
                          type="button"
                          key={ch}
                          onClick={() => setForm({ ...form, channel: ch })}
                          className={`flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-md border transition-colors ${
                            active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted border-border"
                          }`}
                        >
                          <Icon className="h-4 w-4" /> {ch === "email" ? "Email" : "SMS"}
                        </button>
                      );
                    })}
                  </div>
                  {form.channel === "sms" && (
                    <div className="mt-2 space-y-2">
                      <A2pStatusBanner variant="compact" />
                      {smsBlocked && (
                        <Alert className="border-amber-500/40 bg-amber-500/5">
                          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                          <AlertTitle>SMS launching temporarily locked</AlertTitle>
                          <AlertDescription className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              SMS Campaign launching is temporarily locked pending carrier A2P compliance approval. Please complete or check your status on the SMS Compliance page.
                            </p>
                            <Button asChild size="sm" variant="outline">
                              <Link to="/sms-compliance">Go to SMS Compliance</Link>
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Sent only to contacts with a phone number and SMS opt-in. STOP/HELP keywords are auto-handled.
                      </p>
                    </div>
                  )}
                </div>

                {locations.length > 0 && (
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Target locations
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                      Leave empty to target all contacts. Each location's Google URL is used automatically.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {locations.map((loc) => {
                        const active = selectedLocationIds.includes(loc.id);
                        return (
                          <button
                            type="button"
                            key={loc.id}
                            onClick={() =>
                              setSelectedLocationIds((prev) =>
                                active ? prev.filter((id) => id !== loc.id) : [...prev, loc.id],
                              )
                            }
                            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-border"
                            }`}
                          >
                            {loc.name}
                            {loc.is_primary && " ★"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.channel === "email" && (
                  <div>
                    <Label htmlFor="subject">Email subject</Label>
                    <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label htmlFor="msg">{form.channel === "sms" ? "SMS message (link added automatically)" : "Message"}</Label>
                  <Textarea id="msg" rows={4} value={form.message_body} onChange={(e) => setForm({ ...form, message_body: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="g">Default Google review URL</Label>
                  <Input id="g" value={form.google_review_url} onChange={(e) => setForm({ ...form, google_review_url: e.target.value })} placeholder="https://g.page/r/..." />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used when a contact has no location, or their location has no URL set. 1-3★ ratings stay private.
                  </p>
                </div>
                <div>
                  <Label htmlFor="when">Send at</Label>
                  <Input id="when" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || smsBlocked}>
                  <Send className="h-4 w-4 mr-2" />
                  {createMut.isPending ? "Scheduling…" : "Schedule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {contacts.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-6">
              <Users className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Add contacts before creating a campaign.{" "}
                <a className="text-primary underline" href="/contacts">Go to Contacts →</a>
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3">
          {campaigns.length === 0 && (
            <EmptyState
              icon={Send}
              title="No campaigns yet"
              description={
                contacts.length === 0
                  ? "Upload contacts first, then schedule a branded review request to send by email or SMS."
                  : "Schedule your first review request campaign. We'll route happy customers to Google and unhappy ones to private feedback."
              }
              action={
                contacts.length === 0 ? (
                  <Button asChild>
                    <Link to="/contacts"><Users className="h-4 w-4 mr-2" /> Add contacts</Link>
                  </Button>
                ) : (
                  <Button onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> New campaign
                  </Button>
                )
              }
            />
          )}
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(c.scheduled_at), "PPpp")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    {c.channel === "sms" ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                    {c.channel === "sms" ? "SMS" : "Email"}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-2 pt-0 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setQrCampaign(c)}>
                  <QrCode className="h-4 w-4 mr-2" />QR Code
                </Button>
                {c.status === "scheduled" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => sendNowMut.mutate(c.id)}
                      disabled={sendNowMut.isPending}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {sendNowMut.isPending ? "Sending…" : "Send now"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancelMut.mutate(c.id)}>
                      Cancel
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={!!qrCampaign} onOpenChange={(v) => !v && setQrCampaign(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>QR code for {qrCampaign?.name}</DialogTitle>
              <DialogDescription>
                Print and place in-store. Scanning takes customers straight to the rating page.
              </DialogDescription>
            </DialogHeader>
            {qrCampaign && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeCanvas
                    value={qrCampaign.google_review_url || `${window.location.origin}/`}
                    size={220}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center break-all">
                  {qrCampaign.google_review_url || "Add a Google review URL to this campaign"}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Walk-in customers who scan this go directly to your Google review page.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  </>
  );
}
