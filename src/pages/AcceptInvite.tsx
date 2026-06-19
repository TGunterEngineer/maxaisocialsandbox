import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, ShieldAlert, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface InviteData {
  invitation_id: string;
  organization_id: string;
  organization_name: string;
  organization_logo_url: string | null;
  email: string;
  role: string;
  expired: boolean;
  accepted: boolean;
}

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [emailMismatch, setEmailMismatch] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invitation_by_token", { _token: token! });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Invitation not found");
      return data[0] as InviteData;
    },
    enabled: !!token,
    retry: false,
  });

  const acceptMut = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.rpc("accept_invitation", { _token: token! });
      if (error) throw error;
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(`Joined ${data?.organization_name}!`);
      // Switch to the new org
      if (result?.organization_id) {
        localStorage.setItem("selected_org_id", result.organization_id);
      }
      qc.invalidateQueries();
      navigate("/");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (data && user && data.email.toLowerCase() !== user.email?.toLowerCase()) {
      setEmailMismatch(true);
    }
  }, [data, user]);

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-2" />
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>This link is invalid or has been revoked.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data.accepted) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <CardTitle>Already accepted</CardTitle>
            <CardDescription>This invitation has already been used.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.expired) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-2" />
            <CardTitle>Invitation expired</CardTitle>
            <CardDescription>Ask for a new invite from your team admin.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {data.organization_logo_url ? (
            <img
              src={data.organization_logo_url}
              alt={data.organization_name}
              className="h-14 w-14 rounded-lg mx-auto mb-3 object-cover"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-primary/10 grid place-items-center mx-auto mb-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          )}
          <CardTitle>Join {data.organization_name}</CardTitle>
          <CardDescription>
            You've been invited as a <strong className="capitalize">{data.role}</strong> for{" "}
            <strong>{data.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!user ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Sign in or create an account with <strong>{data.email}</strong> to accept.
              </p>
              <Button asChild className="w-full">
                <Link to={`/auth?redirect=/invite/${token}&email=${encodeURIComponent(data.email)}`}>
                  Continue
                </Link>
              </Button>
            </>
          ) : emailMismatch ? (
            <>
              <p className="text-sm text-destructive text-center">
                You're signed in as <strong>{user.email}</strong>, but this invitation is for{" "}
                <strong>{data.email}</strong>.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate(`/auth?redirect=/invite/${token}&email=${encodeURIComponent(data.email)}`);
                }}
              >
                Sign out and switch account
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending}
            >
              {acceptMut.isPending ? "Joining…" : `Accept and join ${data.organization_name}`}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
