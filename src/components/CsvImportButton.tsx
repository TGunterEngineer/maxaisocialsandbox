import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const isDemoActive = (userId: string | undefined) => {
  if (typeof window === "undefined") return false;
  const key = userId ? `dashboard_demo_mode:${userId}` : "dashboard_demo_mode:anon";
  return localStorage.getItem(key) === "true";
};

const VALID_SOURCES = ["google","facebook","instagram","yelp","trustpilot","manual","webhook","outscraper","other"];

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
      } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

export function CsvImportButton() {
  const { organizationId } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!organizationId) return;
    if (isDemoActive(user?.id)) {
      toast.error("Demo data mode is on. Turn it off to import real reviews.");
      if (ref.current) ref.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("CSV must be ≤ 5MB"); return; }
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const records: any[] = [];
      const errors: string[] = [];
      rows.forEach((r, i) => {
        const source = (r.source || "manual").toLowerCase();
        if (!VALID_SOURCES.includes(source)) { errors.push(`Row ${i+2}: invalid source`); return; }
        const author_name = (r.author_name || r.name || r.author || "").trim();
        const review_text = (r.text || r.review || r.review_text || r.content || "").trim();
        if (!author_name) { errors.push(`Row ${i+2}: missing author_name`); return; }
        if (!review_text) { errors.push(`Row ${i+2}: missing text`); return; }
        let rating: number | null = null;
        if (r.rating) {
          const n = Number(r.rating);
          if (!Number.isFinite(n) || n < 1 || n > 5) { errors.push(`Row ${i+2}: invalid rating`); return; }
          rating = Math.round(n);
        }
        records.push({
          organization_id: organizationId,
          source,
          external_id: r.external_id || null,
          author_name: author_name.slice(0, 200),
          rating,
          text: review_text.slice(0, 5000),
          review_url: r.review_url || null,
          review_date: r.review_date ? new Date(r.review_date).toISOString() : new Date().toISOString(),
        });
      });
      if (records.length === 0) { toast.error(errors[0] || "No valid rows found"); return; }
      const { error } = await supabase.from("reviews").upsert(records, {
        onConflict: "organization_id,source,external_id", ignoreDuplicates: false,
      });
      if (error) { toast.error(error.message); return; }
      toast.success(`Imported ${records.length} review${records.length === 1 ? "" : "s"}${errors.length ? ` · ${errors.length} skipped` : ""}`);
      qc.invalidateQueries({ queryKey: ["reviews", organizationId] });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        <Upload className="h-3.5 w-3.5 mr-1" /> {busy ? "Importing..." : "Import CSV"}
      </Button>
    </>
  );
}
