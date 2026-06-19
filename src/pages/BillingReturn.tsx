import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refetch, isActive } = useSubscription();

  // Poll for webhook to land
  useEffect(() => {
    const intv = setInterval(() => refetch(), 2000);
    const stop = setTimeout(() => clearInterval(intv), 30000);
    return () => {
      clearInterval(intv);
      clearTimeout(stop);
    };
  }, [refetch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold">Payment received</h1>
          <p className="text-muted-foreground text-sm">
            {isActive
              ? "Your subscription is active. You're all set!"
              : "We're activating your subscription. This usually takes a few seconds."}
          </p>
          {sessionId && (
            <p className="text-xs text-muted-foreground/70 break-all">Session: {sessionId}</p>
          )}
          <Button asChild className="w-full">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
