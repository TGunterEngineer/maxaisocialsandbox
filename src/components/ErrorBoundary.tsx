import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logClientError } from "@/hooks/useTelemetry";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label identifying which route/section this boundary protects. */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

function logErrorLocal(error: Error, info?: { componentStack?: string | null }) {
  const errorId = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const payload = {
      id: errorId,
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
    };
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", payload);
    if (typeof window !== "undefined") {
      const key = "app_error_log";
      const existing = JSON.parse(window.localStorage.getItem(key) || "[]");
      existing.unshift(payload);
      window.localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
    }
  } catch {
    // ignore logging failures
  }
  return errorId;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorId: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorId: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorId = logErrorLocal(error, { componentStack: info.componentStack });
    this.setState({ errorId });
    // Fire-and-forget remote telemetry to public.error_logs.
    void logClientError({
      message: error?.message ?? "Unknown render error",
      stack: error?.stack ?? null,
      componentStack: info.componentStack ?? null,
      component: this.props.context ?? "ErrorBoundary",
      level: "error",
      context: { error_id: errorId },
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Our team has been notified. You can try reloading the page or returning home.
            </p>
            {this.state.errorId && (
              <p className="text-xs text-muted-foreground font-mono pt-1">
                Reference: {this.state.errorId}
              </p>
            )}
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details className="text-left bg-muted rounded-md p-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Error details (dev only)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-destructive">
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={this.handleReload} variant="default">
              <RefreshCw className="w-4 h-4" /> Reload
            </Button>
            <Button onClick={this.handleHome} variant="outline">
              <Home className="w-4 h-4" /> Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
