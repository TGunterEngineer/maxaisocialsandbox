import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToneProvider } from "@/contexts/ToneContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppModeProvider } from "@/contexts/AppModeContext";
import { SandboxBanner } from "@/components/SandboxBanner";
import { DemoBanner } from "@/components/DemoBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Eager
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy
const Index = lazy(() => import("./pages/Index.tsx"));
const Demo = lazy(() => import("./pages/Demo.tsx"));
const PostCreator = lazy(() => import("./pages/PostCreator.tsx"));
const ContentCalendar = lazy(() => import("./pages/ContentCalendar.tsx"));
const BrandVoice = lazy(() => import("./pages/BrandVoice.tsx"));
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
const Privacy = lazy(() => import("./pages/legal/Privacy.tsx"));
const Terms = lazy(() => import("./pages/legal/Terms.tsx"));
const Refunds = lazy(() => import("./pages/legal/Refunds.tsx"));
const SmsConsent = lazy(() => import("./pages/legal/SmsConsent.tsx"));
const SmsCompliance = lazy(() => import("./pages/SmsCompliance.tsx"));
const ReviewSources = lazy(() => import("./pages/ReviewSources.tsx"));
const AiLab = lazy(() => import("./pages/AiLab.tsx"));
const AboutDemo = lazy(() => import("./pages/AboutDemo.tsx"));
const ReputationManagementGuide = lazy(() => import("./pages/guides/ReputationManagement.tsx"));

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
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
                  <DemoBanner />
                  <SandboxBanner />
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      {/* Demo mode — auth/billing/pricing routes redirect to dashboard */}
                      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/reset-password" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/pricing" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/billing" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/billing/return" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />

                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/landing" element={<Landing />} />
                      <Route path="/demo" element={<Demo />} />
                      <Route path="/dashboard" element={<ErrorBoundary context="route:/dashboard"><Index /></ErrorBoundary>} />
                      <Route path="/posts" element={<PostCreator />} />
                      <Route path="/calendar" element={<ContentCalendar />} />
                      <Route path="/brand" element={<BrandVoice />} />
                      <Route path="/contacts" element={<Contacts />} />
                      <Route path="/campaigns" element={<ErrorBoundary context="route:/campaigns"><Campaigns /></ErrorBoundary>} />
                      <Route path="/feedback" element={<Feedback />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/insights" element={<Insights />} />
                      <Route path="/locations" element={<Locations />} />
                      <Route path="/team" element={<Team />} />
                      <Route path="/branding" element={<Branding />} />
                      <Route path="/webhooks" element={<Webhooks />} />
                      <Route path="/sms-compliance" element={<SmsCompliance />} />
                      <Route path="/review-sources" element={<ReviewSources />} />
                      <Route path="/ai-lab" element={<AiLab />} />
                      <Route path="/about-this-demo" element={<AboutDemo />} />
                      <Route path="/super-admin" element={<SuperAdmin />} />
                      <Route path="/super-admin/demo" element={<SuperAdminDemo />} />
                      <Route path="/invite/:token" element={<AcceptInvite />} />
                      <Route path="/r/:token" element={<RatingPage />} />
                      <Route path="/unsubscribe" element={<Unsubscribe />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/refunds" element={<Refunds />} />
                      <Route path="/refund-policy" element={<Refunds />} />
                      <Route path="/cancellation-policy" element={<Refunds />} />
                      <Route path="/sms-consent" element={<SmsConsent />} />
                      <Route path="/guides/reputation-management-for-local-business" element={<ReputationManagementGuide />} />
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
