import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [loading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, company_name: companyName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // Supabase returns an obfuscated user with empty identities[] when the
        // email is already registered (anti-enumeration). Detect and inform.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          toast({
            title: "Account already exists",
            description: "An account with this email already exists. Try signing in or resetting your password.",
            variant: "destructive",
          });
          setMode("signin");
          setPassword("");
          return;
        }
        toast({ title: "Check your email", description: "We sent you a confirmation link." });

      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "If an account exists, we've sent password reset instructions.",
        });
        setMode("signin");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      // If redirected, browser will navigate away; otherwise session is established.
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-white">
      {/* Ambient brand glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand */}
          <a href="/" className="mb-6 flex items-center justify-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500">
              <Zap className="h-4 w-4 text-[#0a0a0f]" />
            </div>
            <span className="font-semibold tracking-tight">Maximum Social</span>
          </a>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl text-white shadow-[0_0_60px_-15px_rgba(16,185,129,0.25)]">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl">
                <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                  {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
                </span>
              </CardTitle>
              <CardDescription className="text-white/60">
                {mode === "signup"
                  ? "Set up your Maximum Social workspace"
                  : mode === "forgot"
                  ? "Enter your email and we'll send you a reset link"
                  : "Sign in to your dashboard"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mode !== "forgot" && (
                <>
                  <Button
                    type="button"
                    onClick={handleGoogle}
                    disabled={submitting}
                    variant="outline"
                    className="w-full border-white/10 bg-white text-[#0a0a0f] hover:bg-white/90"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                    </svg>
                    Continue with Google
                  </Button>
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs uppercase tracking-wider text-white/40">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-white/80">Full Name</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Doe"
                        required
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-emerald-400/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-white/80">Company Name</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Inc."
                        required
                        className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-emerald-400/50"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-emerald-400/50"
                  />
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-white/80">Password</Label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-xs text-emerald-300 underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-emerald-400/50"
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#0a0a0f] hover:opacity-90"
                >
                  {submitting
                    ? "Loading..."
                    : mode === "signup"
                    ? "Create Account"
                    : mode === "forgot"
                    ? "Send Reset Link"
                    : "Sign In"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <a
                  href="/demo"
                  className="inline-flex items-center justify-center text-sm font-medium text-emerald-300 underline-offset-4 hover:underline"
                >
                  View interactive demo →
                </a>
              </div>

              <div className="mt-4 text-center text-sm text-white/60">
                {mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button onClick={() => setMode("signin")} className="text-emerald-300 underline-offset-4 hover:underline">
                      Sign in
                    </button>
                  </>
                ) : mode === "forgot" ? (
                  <button onClick={() => setMode("signin")} className="text-emerald-300 underline-offset-4 hover:underline">
                    Back to sign in
                  </button>
                ) : (
                  <>
                    Don't have an account?{" "}
                    <button onClick={() => setMode("signup")} className="text-emerald-300 underline-offset-4 hover:underline">
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
