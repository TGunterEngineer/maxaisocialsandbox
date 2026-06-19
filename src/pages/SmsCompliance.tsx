import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Copy, ExternalLink, ShieldAlert, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "draft" | "submitted" | "approved" | "rejected";

interface A2PRow {
  id?: string;
  organization_id: string;
  legal_business_name: string | null;
  business_type: string | null;
  ein: string | null;
  business_industry: string | null;
  business_website: string | null;
  business_address: string | null;
  business_city: string | null;
  business_state: string | null;
  business_postal_code: string | null;
  business_country: string | null;
  business_email: string | null;
  business_phone: string | null;
  rep_first_name: string | null;
  rep_last_name: string | null;
  rep_email: string | null;
  rep_phone: string | null;
  rep_title: string | null;
  campaign_use_case: string | null;
  campaign_description: string | null;
  message_sample_1: string | null;
  message_sample_2: string | null;
  opt_in_method: string | null;
  opt_in_keywords: string | null;
  opt_out_keywords: string | null;
  help_keywords: string | null;
  help_message: string | null;
  status: Status;
  twilio_brand_sid: string | null;
  twilio_campaign_sid: string | null;
  notes: string | null;
}

const EMPTY = (orgId: string): A2PRow => ({
  organization_id: orgId,
  legal_business_name: "",
  business_type: "llc",
  ein: "",
  business_industry: "PROFESSIONAL",
  business_website: "",
  business_address: "",
  business_city: "",
  business_state: "",
  business_postal_code: "",
  business_country: "US",
  business_email: "",
  business_phone: "",
  rep_first_name: "",
  rep_last_name: "",
  rep_email: "",
  rep_phone: "",
  rep_title: "Owner",
  campaign_use_case: "CUSTOMER_CARE",
  campaign_description: "",
  message_sample_1: "",
  message_sample_2: "",
  opt_in_method: "web_form",
  opt_in_keywords: "START,SUBSCRIBE,YES",
  opt_out_keywords: "STOP,STOPALL,UNSUBSCRIBE,END,QUIT,CANCEL",
  help_keywords: "HELP,INFO",
  help_message: "",
  status: "draft",
  twilio_brand_sid: "",
  twilio_campaign_sid: "",
  notes: "",
});

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

export default function SmsCompliance() {
  const { organizationId, organization } = useOrganization();
  const [row, setRow] = useState<A2PRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("a2p_registrations")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) console.error(error);
      setRow((data as A2PRow) ?? EMPTY(organizationId));
      setLoading(false);
    })();
  }, [organizationId]);

  // Pre-fill defaults from organization
  useEffect(() => {
    if (!row || !organization) return;
    if (!row.legal_business_name && organization.name) {
      setRow({ ...row, legal_business_name: organization.name });
    }
  }, [organization, row]);

  const update = (patch: Partial<A2PRow>) =>
    setRow((r) => (r ? { ...r, ...patch } : r));

  const checklist = useMemo(() => {
    if (!row) return [];
    return [
      { label: "Legal business name", done: !!row.legal_business_name },
      { label: "Business type", done: !!row.business_type },
      {
        label: "EIN (or sole-prop SSN)",
        done: row.business_type === "sole_proprietor" || !!row.ein,
      },
      { label: "Business website (with SMS consent disclosure)", done: !!row.business_website },
      { label: "Business address", done: !!row.business_address && !!row.business_city },
      { label: "Authorized representative info", done: !!row.rep_first_name && !!row.rep_email },
      { label: "Campaign description (40+ chars)", done: (row.campaign_description?.length ?? 0) >= 40 },
      { label: "Two sample messages", done: !!row.message_sample_1 && !!row.message_sample_2 },
      { label: "Opt-in method documented", done: !!row.opt_in_method },
      { label: "Help message", done: !!row.help_message },
    ];
  }, [row]);

  const completion = checklist.length
    ? Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100)
    : 0;
  const allDone = checklist.every((c) => c.done);

  const save = async (newStatus?: Status) => {
    if (!row || !organizationId) return;
    setSaving(true);
    const payload = {
      ...row,
      organization_id: organizationId,
      ...(newStatus ? { status: newStatus } : {}),
      ...(newStatus === "submitted" ? { submitted_at: new Date().toISOString() } : {}),
      ...(newStatus === "approved" ? { approved_at: new Date().toISOString() } : {}),
    };
    const { data, error } = await supabase
      .from("a2p_registrations")
      .upsert(payload, { onConflict: "organization_id" })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRow(data as A2PRow);
    toast.success(newStatus ? `Marked as ${newStatus}` : "Saved");
  };

  const generateSamples = () => {
    const biz = row?.legal_business_name || "Acme Co.";
    update({
      message_sample_1: `Hi {{name}}, thanks for visiting ${biz}! How was your experience? Tap to leave a quick rating: {{link}}. Reply STOP to opt out.`,
      message_sample_2: `Reminder from ${biz}: We'd love your feedback on your recent visit — {{link}}. Msg&data rates may apply. Reply HELP for help, STOP to cancel.`,
      help_message: `${biz}: For help, contact support@yourbusiness.com. Reply STOP to unsubscribe. Msg&data rates may apply.`,
      campaign_description:
        row?.campaign_description ||
        `${biz} sends one-time review request and feedback messages to customers who opted in at point of sale, web form, or after a transaction. Frequency: up to 4 msgs/month.`,
    });
    toast.success("Sample messages generated");
  };

  if (loading || !row) {
    return (
      <DashboardLayout title="SMS Compliance">
        <div className="p-6 text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }

  const statusColor: Record<Status, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };

  return (
    <DashboardLayout title="SMS Compliance">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SMS Compliance — A2P 10DLC</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              US carriers require every business sending SMS to register a Brand and Campaign. Without
              registration, your messages will be filtered or blocked. This helper prepares everything
              you need to register in the Twilio Console.
            </p>
          </div>
          <Badge variant="outline" className={statusColor[row.status]}>
            {row.status.toUpperCase()}
          </Badge>
        </div>

        {/* Submission progress: Brand → Campaign → Approval */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submission progress</CardTitle>
            <CardDescription>Track your A2P 10DLC registration from Brand creation to carrier approval.</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const brandDone = !!row.twilio_brand_sid;
              const campaignDone = !!row.twilio_campaign_sid;
              const approvedDone = row.status === "approved";
              const stages = [
                {
                  key: "brand",
                  label: "Brand registered",
                  desc: brandDone ? `SID: ${row.twilio_brand_sid}` : "Create a Brand in Twilio Console and paste the SID below.",
                  done: brandDone,
                  active: !brandDone,
                },
                {
                  key: "campaign",
                  label: "Campaign registered",
                  desc: campaignDone ? `SID: ${row.twilio_campaign_sid}` : brandDone ? "Create a Campaign linked to your Brand and paste the SID." : "Complete Brand registration first.",
                  done: campaignDone,
                  active: brandDone && !campaignDone,
                },
                {
                  key: "approved",
                  label: "Carrier approved",
                  desc: approvedDone ? "Your campaign is live — SMS sending is fully unblocked." : row.status === "submitted" ? "Pending Twilio review (typically 1–3 business days)." : row.status === "rejected" ? "Rejected — review feedback in Twilio Console and resubmit." : "Submit for approval after Brand + Campaign are registered.",
                  done: approvedDone,
                  active: campaignDone && !approvedDone,
                },
              ];
              const completedCount = stages.filter((s) => s.done).length;
              const overallPct = Math.round((completedCount / stages.length) * 100);

              return (
                <div className="space-y-5">
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{completedCount} of {stages.length} stages complete</span>
                      <span>{overallPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${overallPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Stepper */}
                  <ol className="grid gap-3 sm:grid-cols-3">
                    {stages.map((s, i) => {
                      const stateColor = s.done
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : s.active
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-muted/30";
                      const numColor = s.done
                        ? "bg-emerald-500 text-white"
                        : s.active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground";
                      return (
                        <li key={s.key} className={`relative rounded-lg border p-4 transition ${stateColor}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${numColor}`}>
                              {s.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                            </div>
                            <span className="font-medium text-sm">{s.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground break-words">{s.desc}</p>
                          {s.active && (
                            <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-wider">
                              In progress
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Readiness checklist</span>
              <span className="text-sm font-normal text-muted-foreground">{completion}% complete</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {checklist.map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-sm">
                  {c.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={c.done ? "" : "text-muted-foreground"}>{c.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="brand">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="brand">1. Brand</TabsTrigger>
            <TabsTrigger value="campaign">2. Campaign</TabsTrigger>
            <TabsTrigger value="optin">3. Opt-in</TabsTrigger>
            <TabsTrigger value="submit">4. Submit</TabsTrigger>
          </TabsList>

          {/* BRAND */}
          <TabsContent value="brand" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>
                  This must match your IRS records exactly — mismatches are the #1 cause of rejection.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Legal business name *</Label>
                  <Input
                    value={row.legal_business_name ?? ""}
                    onChange={(e) => update({ legal_business_name: e.target.value })}
                    placeholder="As it appears on your IRS EIN letter"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business type *</Label>
                  <Select
                    value={row.business_type ?? ""}
                    onValueChange={(v) => update({ business_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                      <SelectItem value="llc">LLC</SelectItem>
                      <SelectItem value="corporation">Corporation</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                      <SelectItem value="non_profit">Non-Profit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>EIN {row.business_type === "sole_proprietor" ? "(optional)" : "*"}</Label>
                  <Input
                    value={row.ein ?? ""}
                    onChange={(e) => update({ ein: e.target.value })}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry *</Label>
                  <Select
                    value={row.business_industry ?? ""}
                    onValueChange={(v) => update({ business_industry: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROFESSIONAL">Professional Services</SelectItem>
                      <SelectItem value="RETAIL">Retail</SelectItem>
                      <SelectItem value="HOSPITALITY">Hospitality / Restaurant</SelectItem>
                      <SelectItem value="HEALTHCARE">Healthcare</SelectItem>
                      <SelectItem value="REAL_ESTATE">Real Estate</SelectItem>
                      <SelectItem value="AUTOMOTIVE">Automotive</SelectItem>
                      <SelectItem value="EDUCATION">Education</SelectItem>
                      <SelectItem value="ENTERTAINMENT">Entertainment</SelectItem>
                      <SelectItem value="TECHNOLOGY">Technology</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Business website *</Label>
                  <Input
                    value={row.business_website ?? ""}
                    onChange={(e) => update({ business_website: e.target.value })}
                    placeholder="https://yourbusiness.com"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Street address *</Label>
                  <Input
                    value={row.business_address ?? ""}
                    onChange={(e) => update({ business_address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input
                    value={row.business_city ?? ""}
                    onChange={(e) => update({ business_city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State *</Label>
                  <Input
                    value={row.business_state ?? ""}
                    onChange={(e) => update({ business_state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postal code *</Label>
                  <Input
                    value={row.business_postal_code ?? ""}
                    onChange={(e) => update({ business_postal_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={row.business_country ?? ""}
                    onChange={(e) => update({ business_country: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business email</Label>
                  <Input
                    type="email"
                    value={row.business_email ?? ""}
                    onChange={(e) => update({ business_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business phone</Label>
                  <Input
                    value={row.business_phone ?? ""}
                    onChange={(e) => update({ business_phone: e.target.value })}
                    placeholder="+15555550100"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Authorized Representative</CardTitle>
                <CardDescription>
                  The person Twilio/TCR will contact for verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First name *</Label>
                  <Input value={row.rep_first_name ?? ""} onChange={(e) => update({ rep_first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last name *</Label>
                  <Input value={row.rep_last_name ?? ""} onChange={(e) => update({ rep_last_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={row.rep_email ?? ""} onChange={(e) => update({ rep_email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input value={row.rep_phone ?? ""} onChange={(e) => update({ rep_phone: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Title</Label>
                  <Input value={row.rep_title ?? ""} onChange={(e) => update({ rep_title: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CAMPAIGN */}
          <TabsContent value="campaign" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Campaign Details</span>
                  <Button size="sm" variant="outline" onClick={generateSamples}>
                    <Sparkles className="h-4 w-4 mr-1.5" /> Generate samples
                  </Button>
                </CardTitle>
                <CardDescription>
                  Use case <strong>Customer Care</strong> is recommended for review-request flows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Use case</Label>
                  <Select
                    value={row.campaign_use_case ?? ""}
                    onValueChange={(v) => update({ campaign_use_case: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUSTOMER_CARE">Customer Care (recommended)</SelectItem>
                      <SelectItem value="MARKETING">Marketing / Promotional</SelectItem>
                      <SelectItem value="ACCOUNT_NOTIFICATION">Account Notifications</SelectItem>
                      <SelectItem value="MIXED">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Campaign description * (40-4096 chars)</Label>
                  <Textarea
                    rows={4}
                    value={row.campaign_description ?? ""}
                    onChange={(e) => update({ campaign_description: e.target.value })}
                    placeholder="Describe what messages you'll send, when, and to whom."
                  />
                  <p className="text-xs text-muted-foreground">
                    {(row.campaign_description?.length ?? 0)} chars
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Sample message #1 *</Label>
                  <Textarea
                    rows={3}
                    value={row.message_sample_1 ?? ""}
                    onChange={(e) => update({ message_sample_1: e.target.value })}
                    placeholder="Include brand name, opt-out instructions (Reply STOP), and {{variables}}"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sample message #2 *</Label>
                  <Textarea
                    rows={3}
                    value={row.message_sample_2 ?? ""}
                    onChange={(e) => update({ message_sample_2: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>HELP message *</Label>
                  <Textarea
                    rows={2}
                    value={row.help_message ?? ""}
                    onChange={(e) => update({ help_message: e.target.value })}
                    placeholder="Auto-reply when a recipient texts HELP"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OPT-IN */}
          <TabsContent value="optin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Opt-in & Keywords</CardTitle>
                <CardDescription>
                  TCR requires proof of how recipients consent. Your{" "}
                  <Link to="/sms-consent" className="text-primary underline">
                    SMS Consent Disclosure
                  </Link>{" "}
                  page satisfies the public-facing requirement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>How do customers opt in? *</Label>
                  <Select
                    value={row.opt_in_method ?? ""}
                    onValueChange={(v) => update({ opt_in_method: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web_form">Web form with SMS checkbox</SelectItem>
                      <SelectItem value="paper_form">Paper form (in-store)</SelectItem>
                      <SelectItem value="verbal">Verbal at point of sale</SelectItem>
                      <SelectItem value="pos">POS system / receipt prompt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Opt-in keywords</Label>
                    <Input
                      value={row.opt_in_keywords ?? ""}
                      onChange={(e) => update({ opt_in_keywords: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Opt-out keywords</Label>
                    <Input
                      value={row.opt_out_keywords ?? ""}
                      onChange={(e) => update({ opt_out_keywords: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HELP keywords</Label>
                    <Input
                      value={row.help_keywords ?? ""}
                      onChange={(e) => update({ help_keywords: e.target.value })}
                    />
                  </div>
                </div>
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-sm space-y-2">
                    <p className="font-medium flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      Required disclosure language for your opt-in form:
                    </p>
                    <pre className="text-xs bg-background p-3 rounded border whitespace-pre-wrap font-mono">
{`By providing your phone number, you agree to receive SMS messages from ${row.legal_business_name || "[Business Name]"} for review requests and feedback. Message frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help. See our SMS Terms and Privacy Policy.`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copy(
                          `By providing your phone number, you agree to receive SMS messages from ${row.legal_business_name || "[Business Name]"} for review requests and feedback. Message frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help. See our SMS Terms and Privacy Policy.`,
                          "Disclosure",
                        )
                      }
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy disclosure
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SUBMIT */}
          <TabsContent value="submit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Submit to Twilio</CardTitle>
                <CardDescription>
                  Copy these values into Twilio Console → Messaging → Regulatory Compliance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!allDone && (
                  <div className="border border-amber-500/40 bg-amber-500/5 rounded-md p-3 text-sm flex gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span>
                      Complete all checklist items above before submitting. Twilio rejects incomplete
                      brands and you'll lose the $4 vetting fee.
                    </span>
                  </div>
                )}

                <ol className="space-y-3 text-sm list-decimal list-inside">
                  <li>
                    Open the Twilio Console A2P 10DLC page.
                    <Button asChild size="sm" variant="link" className="px-1">
                      <a
                        href="https://console.twilio.com/us1/develop/sms/regulatory-compliance/onboarding"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Twilio <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </li>
                  <li>Create a <strong>Customer Profile</strong> using the Brand info above.</li>
                  <li>Create a <strong>Brand Registration</strong> — Twilio charges $4 vetting fee.</li>
                  <li>
                    Create a <strong>Messaging Service</strong>, attach your Twilio phone number, and
                    register a Campaign with use case <strong>{row.campaign_use_case}</strong>.
                  </li>
                  <li>
                    Paste the campaign description and both sample messages from this page (use copy
                    buttons below).
                  </li>
                  <li>Once submitted, paste the SIDs back here to track status.</li>
                </ol>

                <Separator />

                <div className="grid sm:grid-cols-2 gap-3">
                  <CopyField
                    label="Campaign description"
                    value={row.campaign_description ?? ""}
                  />
                  <CopyField label="Sample #1" value={row.message_sample_1 ?? ""} />
                  <CopyField label="Sample #2" value={row.message_sample_2 ?? ""} />
                  <CopyField label="HELP message" value={row.help_message ?? ""} />
                  <CopyField label="Opt-out keywords" value={row.opt_out_keywords ?? ""} />
                  <CopyField label="Website (must show consent)" value={row.business_website ?? ""} />
                </div>

                <Separator />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Twilio Brand SID</Label>
                    <Input
                      value={row.twilio_brand_sid ?? ""}
                      onChange={(e) => update({ twilio_brand_sid: e.target.value })}
                      placeholder="BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Twilio Campaign SID</Label>
                    <Input
                      value={row.twilio_campaign_sid ?? ""}
                      onChange={(e) => update({ twilio_campaign_sid: e.target.value })}
                      placeholder="QExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={row.notes ?? ""}
                    onChange={(e) => update({ notes: e.target.value })}
                    placeholder="Internal notes, rejection reasons, follow-ups…"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 sticky bottom-4 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg">
          <div className="text-sm text-muted-foreground">
            Saved progress is private to your team managers.
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              variant="outline"
              onClick={() => save("submitted")}
              disabled={saving || !allDone}
            >
              Mark as submitted
            </Button>
            <Button
              onClick={() => save("approved")}
              disabled={saving || !row.twilio_campaign_sid}
            >
              Mark approved
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3 space-y-1.5 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => copy(value, label)}
          disabled={!value}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">
        {value || <span className="text-muted-foreground italic">empty</span>}
      </p>
    </div>
  );
}
