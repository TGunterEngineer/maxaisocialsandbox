import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// In demo mode every visitor is auto-signed-in to a fixed shared demo account
// that's pre-seeded with random data, so all pages render meaningful content.
async function ensureDemoSession(): Promise<Session | null> {
  const { data: { session: existing } } = await supabase.auth.getSession();
  if (existing) return existing;

  const { data, error } = await supabase.functions.invoke<{
    email: string;
    password: string;
  }>("demo-bootstrap");
  if (error || !data) {
    console.error("demo-bootstrap failed", error);
    return null;
  }
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });
  if (signInErr) {
    console.error("demo sign-in failed", signInErr);
    return null;
  }
  return signIn.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    (async () => {
      if (bootstrappedRef.current) return;
      bootstrappedRef.current = true;
      const s = await ensureDemoSession();
      setSession(s);
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Demo mode: instead of signing out, just refresh the session.
    await supabase.auth.signOut();
    const s = await ensureDemoSession();
    setSession(s);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
