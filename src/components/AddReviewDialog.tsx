import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

const isDemoActive = (userId: string | undefined) => {
  if (typeof window === "undefined") return false;
  const key = userId ? `dashboard_demo_mode:${userId}` : "dashboard_demo_mode:anon";
  return localStorage.getItem(key) === "true";
};

const schema = z.object({
  source: z.enum(["google", "facebook", "instagram", "yelp", "trustpilot", "manual", "other"]),
  author_name: z.string().trim().min(1, "Name required").max(200),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  text: z.string().trim().min(1, "Review text required").max(5000),
  review_url: z.string().trim().url("Invalid URL").max(1000).optional().or(z.literal("")),
  review_date: z.string().optional(),
});

export function AddReviewDialog() {
  const { organizationId } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    source: "google" as const,
    author_name: "",
    rating: "5",
    text: "",
    review_url: "",
    review_date: "",
  });

  const handleSubmit = async () => {
    if (!organizationId) return;
    if (isDemoActive(user?.id)) {
      toast.error("Demo data mode is on. Turn it off to add a real review.");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      organization_id: organizationId,
      source: parsed.data.source,
      author_name: parsed.data.author_name,
      rating: parsed.data.rating ?? null,
      text: parsed.data.text,
      review_url: parsed.data.review_url || null,
      review_date: parsed.data.review_date ? new Date(parsed.data.review_date).toISOString() : new Date().toISOString(),
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Review added");
    qc.invalidateQueries({ queryKey: ["reviews", organizationId] });
    setOpen(false);
    setForm({ source: "google", author_name: "", rating: "5", text: "", review_url: "", review_date: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Add review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a review</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v: any) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="yelp">Yelp</SelectItem>
                  <SelectItem value="trustpilot">Trustpilot</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating</Label>
              <Select value={form.rating} onValueChange={(v) => setForm({ ...form, rating: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Customer name</Label>
            <Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} maxLength={200} />
          </div>
          <div>
            <Label>Review text</Label>
            <Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} maxLength={5000} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Review URL (optional)</Label>
              <Input value={form.review_url} onChange={(e) => setForm({ ...form, review_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Date (optional)</Label>
              <Input type="date" value={form.review_date} onChange={(e) => setForm({ ...form, review_date: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Saving..." : "Add review"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
