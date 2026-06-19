/**
 * Unified API service that intercepts edge function calls when the app is in
 * Sandbox (portfolio) mode. In sandbox mode no network requests are made to
 * Lovable AI / Supabase edge functions — responses are synthesized from local
 * mock data after a simulated latency, so the portfolio demo never burns live
 * third-party credits.
 */
import { supabase } from "@/integrations/supabase/client";
import { mockReviews } from "@/data/mockReviews";
import { maxAiReviews } from "@/data/maxAiMockData";

const SANDBOX_LATENCY_MS = 800;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type InvokeResult<T> = { data: T | null; error: { message: string } | null };

/** Synthesize a plausible response for a known edge function. */
function buildSandboxResponse(fn: string, payload: unknown): unknown {
  switch (fn) {
    case "generate-reply": {
      const p = (payload ?? {}) as { reviewText?: string; customerName?: string };
      const name = p.customerName ?? "there";
      return {
        reply: `Hi ${name}, thanks so much for sharing your experience — we really appreciate the feedback and would love to hear more. (Sandbox-generated reply)`,
        tone: "friendly",
        sandbox: true,
      };
    }
    case "generate-insights": {
      return {
        insights: [
          { title: "Response time trending up", detail: "Average reply time improved 18% this week.", severity: "positive" },
          { title: "Recurring theme: wait times", detail: "3 recent low-rating reviews mention long waits.", severity: "warning" },
          { title: "Top performer", detail: "Instagram mentions converted to followers at 4.2%.", severity: "positive" },
        ],
        sandbox: true,
      };
    }
    case "generate-social-posts": {
      return {
        posts: [
          { platform: "instagram", text: "Sunny days call for fresh brews ☀️ Come see what's new on the menu! (sandbox)" },
          { platform: "facebook", text: "Big thanks to everyone who stopped by this weekend — we couldn't do it without you. (sandbox)" },
          { platform: "twitter", text: "New fall menu drops Friday. Who's in? 🍂 (sandbox)" },
        ],
        sandbox: true,
      };
    }
    case "analyze-sentiment": {
      return { sentiment: "positive", score: 0.82, sandbox: true };
    }
    case "send-sms":
    case "create-sms-topup":
    case "create-checkout":
    case "create-portal-session":
    case "dispatch-webhooks":
    case "process-email-queue":
    case "process-review-campaigns": {
      return { success: true, simulated: true, sandbox: true };
    }
    case "widget-reviews":
    case "cron-sync-reviews":
    case "sync-outscraper-reviews": {
      return { reviews: [...mockReviews, ...maxAiReviews], sandbox: true };
    }
    default:
      return { sandbox: true, note: `Sandbox stub for ${fn}` };
  }
}

export interface ApiServiceOptions {
  /** When true, all calls are stubbed locally. */
  sandbox: boolean;
}

export function createApiService({ sandbox }: ApiServiceOptions) {
  return {
    /**
     * Drop-in replacement for `supabase.functions.invoke`. When sandbox is on,
     * resolves with locally generated mock data after a simulated latency.
     */
    async invokeFunction<T = unknown>(
      fn: string,
      options?: { body?: unknown; headers?: Record<string, string> },
    ): Promise<InvokeResult<T>> {
      if (sandbox) {
        await sleep(SANDBOX_LATENCY_MS);
        return { data: buildSandboxResponse(fn, options?.body) as T, error: null };
      }
      const { data, error } = await supabase.functions.invoke(fn, options);
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null };
    },
  };
}

export type ApiService = ReturnType<typeof createApiService>;
