import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Loader2, Palette, Image as ImageIcon, Mail, Building2, BellRing, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex like #3B82F6"),
  email_from_name: z.string().trim().max(60).optional().or(z.literal("")),
  support_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  email_footer_text: z.string().trim().max(300).optional().or(z.literal("")),
  alert_phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,15}$/, "Use E.164 format, e.g. +15558675309")
    .optional()
    .or(z.literal("")),
});

const PRESETS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#10B981", "#0EA5E9", "#EF4444", "#0F172A"];

export default function Branding() {
  const { organization, organizationId, canManageTeam } = useOrganization();
  const { planTier } = useSubscription();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    primary_color: "#3B82F6",
    email_from_name: "",
    support_email: "",
    email_footer_text: "",
    alert_phone: "",
    review_gating_enabled: true,
  });

  const isBatchedTier = planTier === "premium" || planTier === "founder";

  useEffect(() => {
    if (organization) {
      setForm({
        name: organization.name ?? "",
        primary_color: organization.primary_color ?? "#3B82F6",
        email_from_name: (organization as any).email_from_name ?? "",
        support_email: (organization as any).support_email ?? "",
        email_footer_text: (organization as any).email_footer_text ?? "",
        alert_phone: (organization as any).alert_phone ?? "",
        review_gating_enabled: (organization as any).review_gating_enabled ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const logoUrl = (organization as any)?.logo_url ?? null;

  const saveMut = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
      const { error } = await supabase
        .from("organizations")
        .update({
          name: parsed.data.name,
          primary_color: parsed.data.primary_color,
          email_from_name: parsed.data.email_from_name || null,
          support_email: parsed.data.support_email || null,
          email_footer_text: parsed.data.email_footer_text || null,
          alert_phone: parsed.data.alert_phone || null,
          review_gating_enabled: form.review_gating_enabled,
        } as any)
        .eq("id", organizationId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branding saved");
      qc.invalidateQueries({ queryKey: ["user_organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleLogoUpload = async (file: File) => {
    if (!organizationId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${organizationId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("org-logos").getPublicUrl(path);
      const { error: orgErr } = await supabase
        .from("organizations")
        .update({ logo_url: pub.publicUrl })
        .eq("id", organizationId);
      if (orgErr) throw orgErr;
      qc.invalidateQueries({ queryKey: ["user_organizations"] });
      toast.success("Logo updated");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!organizationId) return;
    if (!confirm("Remove the current logo?")) return;
    const { error } = await supabase
      .from("organizations")
      .update({ logo_url: null })
      .eq("id", organizationId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["user_organizations"] });
    toast.success("Logo removed");
  };

  if (!canManageTeam) {
    return (
      <DashboardLayout title="Branding">
        <div className="max-w-2xl mx-auto py-12 text-center">
          <Palette className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-xl font-semibold">Owner or Admin access required</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Ask an organization owner or admin for access to branding.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Branding">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branding</h1>
          <p className="text-muted-foreground mt-1">
            Customize how {form.name || "your organization"} appears on rating pages and emails.
          </p>
        </div>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Logo
            </CardTitle>
            <CardDescription>Shown at the top of the rating page and emails. PNG or SVG, under 2MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Organization logo preview" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                  e.target.value = "";
                }}
              />
              <Button onClick={() => fileInput.current?.click()} disabled={uploading} variant="outline">
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> {logoUrl ? "Replace" : "Upload"} logo</>
                )}
              </Button>
              {logoUrl && (
                <Button variant="ghost" onClick={removeLogo} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Identity
            </CardTitle>
            <CardDescription>Name shown to customers on rating pages and emails.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
              />
            </div>
          </CardContent>
        </Card>

        {/* Color */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" /> Primary color
            </CardTitle>
            <CardDescription>Used for stars, buttons, and accents on customer-facing pages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value.toUpperCase() })}
                className="h-12 w-16 rounded-md border cursor-pointer bg-transparent"
              />
              <Input
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value.toUpperCase() })}
                className="font-mono w-32"
                maxLength={7}
              />
              <div className="flex gap-1.5 flex-wrap">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, primary_color: c })}
                    className={`h-8 w-8 rounded-md border-2 transition-transform hover:scale-110 cursor-pointer ${
                      form.primary_color === c
                        ? "border-foreground ring-2 ring-foreground/30"
                        : "border-border/60"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Set primary color to ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>
            {/* Preview */}
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Preview</p>
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <svg key={n} viewBox="0 0 24 24" className="h-7 w-7" fill={form.primary_color} stroke={form.primary_color}>
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md text-sm font-medium text-white"
                  style={{ backgroundColor: form.primary_color }}
                >
                  Submit
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email branding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email branding
            </CardTitle>
            <CardDescription>Personalize the sender name and footer of every email sent from your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="from-name">Sender name</Label>
              <Input
                id="from-name"
                value={form.email_from_name}
                onChange={(e) => setForm({ ...form, email_from_name: e.target.value })}
                placeholder={form.name || "Your organization"}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Shown in the inbox as "<strong>{form.email_from_name || form.name || "Your organization"}</strong>".
                Leave blank to use your organization name.
              </p>
            </div>
            <div>
              <Label htmlFor="support-email">Support email</Label>
              <Input
                id="support-email"
                type="email"
                value={form.support_email}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                placeholder="support@yourcompany.com"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Optional — shown in email footers so recipients can reply to a real address.
              </p>
            </div>
            <div>
              <Label htmlFor="footer-text">Footer line</Label>
              <Textarea
                id="footer-text"
                rows={2}
                value={form.email_footer_text}
                onChange={(e) => setForm({ ...form, email_footer_text: e.target.value })}
                placeholder="123 Main St, Springfield · Visit us online"
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Optional one-liner above the unsubscribe link in every email.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Admin alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BellRing className="h-4 w-4" /> Admin alerts
                </CardTitle>
                <CardDescription>
                  How owners and admins are notified about low ratings and completed campaigns.
                </CardDescription>
              </div>
              {isBatchedTier ? (
                <Badge className="bg-primary text-primary-foreground">Batched SMS · 15 min</Badge>
              ) : (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  Instant email
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              {isBatchedTier ? (
                <>
                  Premium and Founder plans aggregate alerts into a single summary SMS every
                  <span className="text-foreground font-medium"> 15 minutes</span>. Add a phone
                  number below to enable SMS — otherwise we'll send a digest email instead.
                </>
              ) : (
                <>
                  Starter and Pro plans receive each alert by email via your existing email
                  pipeline. No SMS costs are incurred. Upgrade to Premium for batched summary SMS.
                </>
              )}
            </div>
            <div>
              <Label htmlFor="alert-phone">
                Alert phone {isBatchedTier ? "" : <span className="text-muted-foreground">(Premium / Founder only)</span>}
              </Label>
              <Input
                id="alert-phone"
                value={form.alert_phone}
                onChange={(e) => setForm({ ...form, alert_phone: e.target.value })}
                placeholder="+15558675309"
                maxLength={16}
                disabled={!isBatchedTier}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                E.164 format. Used only for batched admin summaries on Premium and Founder tiers.
              </p>
            </div>
          </CardContent>
        </Card>



        {/* Review gating */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Review gating
                </CardTitle>
                <CardDescription>
                  Filter unhappy customers away from your public Google profile.
                </CardDescription>
              </div>
              <Switch
                checked={form.review_gating_enabled}
                onCheckedChange={(v) => setForm({ ...form, review_gating_enabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground space-y-2">
              {form.review_gating_enabled ? (
                <>
                  <p><span className="text-foreground font-medium">Gating ON</span> — 4 and 5 star ratings go straight to your public Google review page. 1–3 star ratings are kept private and you get an alert so you can resolve them 1-on-1.</p>
                  <p className="text-xs">Note: Google's policy technically discourages review filtering. Most agencies still do this, but use at your own discretion.</p>
                </>
              ) : (
                <p><span className="text-foreground font-medium">Gating OFF</span> — Every rating, including 1–3 stars, is sent directly to your public Google review page. No private feedback form, no low-rating alerts.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end sticky bottom-4">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} size="lg" className="shadow-lg">
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
