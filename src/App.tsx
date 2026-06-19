import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToneProvider } from "@/contexts/ToneContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { SandboxBanner } from "@/components/SandboxBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { OnboardingGate } from "@/components/OnboardingGate";
import { FeatureGate } from "@/components/FeatureGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import type { FeatureKey } from "@/lib/planFeatures";

// Eager: critical public/auth entry routes for fast first paint
import Auth from "./pages/Auth.tsx";
import Landing from "./pages/Landing.tsx";
import { PublicHome } from "./components/PublicHome";
import NotFound from "./pages/NotFound.tsx";

// Lazy: everything else (heavy deps like Recharts, Stripe, editors)
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const Demo = lazy(() => import("./pages/Demo.tsx"));
const PostCreator = lazy(() => import("./pages/PostCreator.tsx"));
const ContentCalendar = lazy(() => import("./pages/ContentCalendar.tsx"));
const BrandVoice = lazy(() => import("./pages/BrandVoice.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin.tsx"));
const SuperAdminDemo = lazy(() => import("./pages/SuperAdminDemo.tsx"));
const Contacts = lazy(() => import("./pages/Contacts.tsx"));
const Campaigns = lazy(() => import("./pages/Campaigns.tsx"));
const Feedback = lazy(() => import("./pages/Feedback.tsx"));
const Analytics = lazy(() => import("./pages/Analytics.tsx"));
const Insights = lazy(() => import("./pages/Insights.tsx"));
const Locations = lazy(() => import("./pages/Locations.tsx"));
const Team = lazy(() => import("./pages/Team.tsx"));
const Branding = lazy(() => import("./pages/Branding.tsx"));
const Webhooks = lazy(() => import("./pages/Webhooks.tsx"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite.tsx"));
const RatingPage = lazy(() => import("./pages/RatingPage.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const Pricing = lazy(() => import("./pages/Pricing.tsx"));
const Billing = lazy(() => import("./pages/Billing.tsx"));
const BillingReturn = lazy(() => import("./pages/BillingReturn.tsx"));
const Privacy = lazy(() => import("./pages/legal/Privacy.tsx"));
const Terms = lazy(() => import("./pages/legal/Terms.tsx"));
const Refunds = lazy(() => import("./pages/legal/Refunds.tsx"));
const SmsConsent = lazy(() => import("./pages/legal/SmsConsent.tsx"));
const SmsCompliance = lazy(() => import("./pages/SmsCompliance.tsx"));
const ReviewSources = lazy(() => import("./pages/ReviewSources.tsx"));

const Paid = ({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature?: FeatureKey;
}) => (
  <ProtectedRoute>
    <SubscriptionGate>
      <OnboardingGate>
        {feature ? <FeatureGate feature={feature}>{children}</FeatureGate> : children}
      </OnboardingGate>
    </SubscriptionGate>
  </ProtectedRoute>
);

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            <ToneProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AppModeProvider>
                  <SandboxBanner />
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/billing" element={<ProtectedRoute><ErrorBoundary context="route:/billing"><Billing /></ErrorBoundary></ProtectedRoute>} />
                      <Route path="/billing/return" element={<ProtectedRoute><BillingReturn /></ProtectedRoute>} />
                      <Route path="/" element={<PublicHome />} />
                      <Route path="/landing" element={<Landing />} />
                      <Route path="/demo" element={<Demo />} />
                      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                      <Route path="/dashboard" element={<Paid feature="inbox"><ErrorBoundary context="route:/dashboard"><Index /></ErrorBoundary></Paid>} />
                      <Route path="/posts" element={<Paid feature="post_creator"><PostCreator /></Paid>} />
                      <Route path="/calendar" element={<Paid feature="content_calendar"><ContentCalendar /></Paid>} />
                      <Route path="/brand" element={<Paid feature="brand_voice"><BrandVoice /></Paid>} />
                      <Route path="/contacts" element={<Paid feature="contacts"><Contacts /></Paid>} />
                      <Route path="/campaigns" element={<Paid feature="campaigns"><ErrorBoundary context="route:/campaigns"><Campaigns /></ErrorBoundary></Paid>} />

                      <Route path="/feedback" element={<Paid feature="feedback"><Feedback /></Paid>} />
                      <Route path="/analytics" element={<Paid feature="analytics"><Analytics /></Paid>} />
                      <Route path="/insights" element={<Paid feature="ai_insights"><Insights /></Paid>} />
                      <Route path="/locations" element={<Paid feature="locations"><Locations /></Paid>} />
                      <Route path="/team" element={<Paid feature="team"><Team /></Paid>} />
                      <Route path="/branding" element={<Paid feature="branding"><Branding /></Paid>} />
                      <Route path="/webhooks" element={<Paid feature="webhooks"><Webhooks /></Paid>} />
                      <Route path="/sms-compliance" element={<Paid feature="sms_compliance"><SmsCompliance /></Paid>} />
                      <Route path="/review-sources" element={<Paid feature="review_sources"><ReviewSources /></Paid>} />
                      <Route path="/super-admin" element={<AdminRoute><SuperAdmin /></AdminRoute>} />
                      <Route path="/super-admin/demo" element={<AdminRoute><SuperAdminDemo /></AdminRoute>} />
                      <Route path="/invite/:token" element={<AcceptInvite />} />
                      <Route path="/r/:token" element={<RatingPage />} />
                      <Route path="/unsubscribe" element={<Unsubscribe />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/refunds" element={<Refunds />} />
                      <Route path="/refund-policy" element={<Refunds />} />
                      <Route path="/cancellation-policy" element={<Refunds />} />
                      <Route path="/sms-consent" element={<SmsConsent />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  </AppModeProvider>
                </BrowserRouter>
              </TooltipProvider>
            </ToneProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
