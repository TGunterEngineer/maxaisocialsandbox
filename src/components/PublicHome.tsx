import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Landing from "@/pages/Landing";

/**
 * Root route behavior:
 * - Non-authenticated visitors see the Auth (login/signup) page,
 *   which includes a "View demo" link to /demo.
 * - Authenticated users are redirected to their dashboard.
 */
export function PublicHome() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Landing />;
}

export default PublicHome;
