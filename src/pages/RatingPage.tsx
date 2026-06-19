import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

type RatingContext = {
  recipient_id: string;
  campaign_id: string;
  organization_id: string;
  organization_name: string;
  organization_logo_url: string | null;
  organization_primary_color: string | null;
  google_review_url: string | null;
  contact_name: string;
  location_name: string | null;
  already_submitted: boolean;
};

export default function RatingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<RatingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_rating_context", { _token: token });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setError("This rating link is invalid or expired.");
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setCtx(row as RatingContext);
        if ((row as RatingContext).already_submitted) {
          setSubmitted(true);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (!rating || !token) return;
    if (rating < 4 && feedback.trim().length < 5) {
      toast.error("Please share a bit about your experience so we can improve.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_review_rating", {
      _token: token,
      _rating: rating,
      _feedback: rating < 4 ? feedback.trim() : null,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = data as { route: string; google_review_url: string | null };
    if (
      result.route === "google" &&
      result.google_review_url &&
      /^https?:\/\//i.test(result.google_review_url)
    ) {
      window.location.href = result.google_review_url;
    } else {
      setSubmitted(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-2">
            <h1 className="text-xl font-semibold">Link not valid</h1>
            <p className="text-sm text-muted-foreground">{error ?? "Please check your link."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <div className="text-5xl">🙏</div>
            <h1 className="text-2xl font-bold">Thank you!</h1>
            <p className="text-muted-foreground">
              {ctx.organization_name} appreciates your feedback.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accent = ctx.organization_primary_color || "#3B82F6";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            {ctx.organization_logo_url && (
              <img
                src={ctx.organization_logo_url}
                alt={ctx.organization_name}
                className="h-12 mx-auto"
              />
            )}
            <h1 className="text-2xl font-bold">
              How was your experience with {ctx.organization_name}?
            </h1>
            {ctx.location_name && (
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {ctx.location_name}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Hi {ctx.contact_name}, your feedback takes 30 seconds.
            </p>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hover ?? rating ?? 0) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setRating(n)}
                  className="transition-transform hover:scale-110"
                  aria-label={`${n} stars`}
                >
                  <Star
                    className="h-10 w-10"
                    fill={active ? accent : "transparent"}
                    style={{ color: accent }}
                  />
                </button>
              );
            })}
          </div>

          {rating !== null && rating < 4 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Sorry to hear that. What went wrong?
              </label>
              <Textarea
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Your honest feedback helps us improve…"
                maxLength={1500}
              />
              <p className="text-xs text-muted-foreground">
                This stays private — it goes directly to the {ctx.organization_name} team.
              </p>
            </div>
          )}

          {rating !== null && rating >= 4 && (
            <p className="text-sm text-center text-muted-foreground">
              Awesome! We'll send you to leave a quick public review.
            </p>
          )}

          <Button
            className="w-full"
            disabled={rating === null || submitting}
            onClick={handleSubmit}
            style={{ backgroundColor: accent }}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
