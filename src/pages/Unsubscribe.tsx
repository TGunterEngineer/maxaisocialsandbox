import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string } })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === true) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setBusy(false);
    if (error) setState("error");
    else if ((data as any)?.success) setState("done");
    else if ((data as any)?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {state === "loading" && <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />}
          {state === "valid" && (
            <>
              <h1 className="text-2xl font-bold">Unsubscribe?</h1>
              <p className="text-muted-foreground text-sm">
                You won't receive any more emails from us.
              </p>
              <Button onClick={confirm} disabled={busy} className="w-full">
                {busy ? "Processing…" : "Confirm Unsubscribe"}
              </Button>
            </>
          )}
          {state === "done" && (
            <>
              <h1 className="text-2xl font-bold">Unsubscribed</h1>
              <p className="text-muted-foreground text-sm">You've been removed from our list.</p>
            </>
          )}
          {state === "already" && (
            <>
              <h1 className="text-2xl font-bold">Already unsubscribed</h1>
              <p className="text-muted-foreground text-sm">No further action needed.</p>
            </>
          )}
          {(state === "invalid" || state === "error") && (
            <>
              <h1 className="text-2xl font-bold">Link not valid</h1>
              <p className="text-muted-foreground text-sm">This unsubscribe link is invalid or expired.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
