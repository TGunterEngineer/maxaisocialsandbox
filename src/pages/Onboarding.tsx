import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import Papa from "papaparse";
import { Check, ChevronRight, MapPin, Upload, Users, Star, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const locationSchema = z.object({
  name: z.string().trim().min(1, "Business name required").max(120),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  google_review_url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .max(500)
    .refine(
      (v) => /google\.com|maps\.app\.goo\.gl|g\.page/i.test(v),
      "Should be a Google review or Maps link",
    ),
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).toLowerCase(),
  phone: z.string().trim().max(40).optional().nullable(),
});

const onboardingKey = (orgId: string) => `onboarding_complete_${orgId}`;

export const isOnboardingComplete = (orgId: string | null) => {
  if (!orgId) return true;
  return localStorage.getItem(onboardingKey(orgId)) === "1";
};

export const markOnboardingComplete = (orgId: string) => {
  localStorage.setItem(onboardingKey(orgId), "1");
};

function OnboardingInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { organizationId, organization } = useOrganization();
  const [step, setStep] = useState(1);
  const [savingLocation, setSavingLocation] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [locForm, setLocForm] = useState({
    name: organization?.name ?? "",
    address: "",
    google_review_url: "",
  });

  // If they already have locations, mark step 1 done & let them skip
  const { data: existingLocations = [] } = useQuery({
    queryKey: ["locations-onboarding", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, google_review_url")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  const hasLocation = existingLocations.length > 0;
  const progress = useMemo(() => (step === 1 ? 33 : step === 2 ? 66 : 100), [step]);

  const handleSaveLocation = async () => {
    if (!organizationId) return;
    const parsed = locationSchema.safeParse(locForm);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid location");
      return;
    }
    setSavingLocation(true);
    try {
      const { error } = await supabase.from("locations").insert({
        organization_id: organizationId,
        name: parsed.data.name,
        address: parsed.data.address || null,
        google_review_url: parsed.data.google_review_url,
        is_primary: true,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["locations-onboarding", organizationId] });
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location saved");
      setStep(2);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleCsvUpload = (file: File) => {
    if (!organizationId) return;
    setImportingContacts(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: async (results) => {
        try {
          const valid: Array<{
            organization_id: string;
            name: string;
            email: string;
            phone: string | null;
          }> = [];
          let skipped = 0;

          results.data.forEach((row) => {
            const parsed = contactSchema.safeParse({
              name: row.name || row["full name"] || row.fullname,
              email: row.email,
              phone: row.phone || row["phone number"] || null,
            });
            if (!parsed.success) {
              skipped++;
              return;
            }
            valid.push({
              organization_id: organizationId,
              name: parsed.data.name,
              email: parsed.data.email,
              phone: parsed.data.phone || null,
            });
          });

          if (valid.length === 0) {
            toast.error("No valid contacts found. Required columns: name, email");
            return;
          }

          const batches: typeof valid[] = [];
          for (let i = 0; i < valid.length; i += 500)
            batches.push(valid.slice(i, i + 500));

          let inserted = 0;
          for (const batch of batches) {
            const { error, count } = await supabase
              .from("contacts")
              .upsert(batch, { onConflict: "organization_id,email", count: "exact" });
            if (error) throw error;
            inserted += count ?? batch.length;
          }
          setImportedCount(inserted);
          toast.success(
            `Imported ${inserted} contacts${skipped ? ` (${skipped} skipped)` : ""}`,
          );
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setImportingContacts(false);
          if (fileRef.current) fileRef.current.value = "";
        }
      },
      error: (err) => {
        toast.error(`CSV parse error: ${err.message}`);
        setImportingContacts(false);
      },
    });
  };

  const finish = () => {
    if (organizationId) markOnboardingComplete(organizationId);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <span className="font-semibold">Welcome to {organization?.name ?? "your workspace"}</span>
          </div>
          <button
            onClick={finish}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            Skip for now
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <Progress value={progress} className="h-1" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span className={step >= 1 ? "text-foreground font-medium" : ""}>1. Location</span>
            <span className={step >= 2 ? "text-foreground font-medium" : ""}>2. Contacts</span>
            <span className={step >= 3 ? "text-foreground font-medium" : ""}>3. Done</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary mb-1">
                <MapPin className="h-5 w-5" />
                <span className="text-xs uppercase tracking-wider font-semibold">Step 1 of 3</span>
              </div>
              <CardTitle>Add your first location</CardTitle>
              <CardDescription>
                We'll send happy customers here to leave a Google review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loc-name">Business name *</Label>
                <Input
                  id="loc-name"
                  value={locForm.name}
                  onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                  placeholder="Acme Coffee — Downtown"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-address">Address (optional)</Label>
                <Input
                  id="loc-address"
                  value={locForm.address}
                  onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
                  placeholder="123 Main St, Springfield"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-url">Google review URL *</Label>
                <Input
                  id="loc-url"
                  value={locForm.google_review_url}
                  onChange={(e) =>
                    setLocForm({ ...locForm, google_review_url: e.target.value })
                  }
                  placeholder="https://g.page/r/..."
                />
                <p className="text-xs text-muted-foreground">
                  Find it: search your business on Google → "Ask for reviews" → copy the
                  short link.
                </p>
              </div>
              <div className="flex justify-between pt-2">
                {hasLocation ? (
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Already added — skip <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={handleSaveLocation} disabled={savingLocation}>
                  {savingLocation ? "Saving…" : "Continue"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Users className="h-5 w-5" />
                <span className="text-xs uppercase tracking-wider font-semibold">Step 2 of 3</span>
              </div>
              <CardTitle>Import your customer list</CardTitle>
              <CardDescription>
                Upload a CSV with <code className="text-foreground">name</code>,{" "}
                <code className="text-foreground">email</code>, and optional{" "}
                <code className="text-foreground">phone</code>. You can do this later too.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
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
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={importingContacts}
                >
                  {importingContacts ? "Importing…" : "Choose CSV file"}
                </Button>
                {importedCount > 0 && (
                  <p className="mt-3 text-sm text-primary flex items-center justify-center gap-1">
                    <Check className="h-4 w-4" />
                    {importedCount} contacts imported
                  </p>
                )}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={() => setStep(3)}>
                  {importedCount > 0 ? "Continue" : "Skip"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>You're all set!</CardTitle>
              <CardDescription>
                Your workspace is ready. Create your first review campaign next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> Location added
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {importedCount > 0
                  ? `${importedCount} contacts imported`
                  : "Contacts (you can import anytime)"}
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> Review routing configured
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={finish} size="lg">
                  Go to dashboard <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function Onboarding() {
  return (
    <ProtectedRoute>
      <SubscriptionGate>
        <OnboardingInner />
      </SubscriptionGate>
    </ProtectedRoute>
  );
}
