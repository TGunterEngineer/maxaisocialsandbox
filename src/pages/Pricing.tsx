import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFounderSlotsRemaining, useSubscription } from "@/hooks/useSubscription";
import { useOrganization } from "@/hooks/useOrganization";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { isPaymentsConfigured } from "@/lib/stripe";

type PlanId = "founder" | "essential" | "growth" | "premium";

interface PlanCard {
  id: PlanId;
  name: string;
  monthly: number;
  setup: number;
  description: string;
  features: string[];
  highlight?: boolean;
  founderOnly?: boolean;
}

const PLANS: PlanCard[] = [
  {
    id: "essential",
    name: "Essential",
    monthly: 99,
    setup: 199,
    description: "For single-location businesses getting started.",
    features: [
      "1 location",
      "Unified review inbox",
      "AI reply drafts",
      "Basic review requests",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 199,
    setup: 399,
    description: "For growing multi-location brands.",
    highlight: true,
    features: [
      "Up to 5 locations",
      "Everything in Essential",
      "SMS + email campaigns",
      "Social post scheduler",
      "AI insights & analytics",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    monthly: 399,
    setup: 799,
    description: "For agencies and unlimited-location brands.",
    features: [
      "Unlimited locations",
      "Everything in Growth",
      "Multi-user team access",
      "Branding & white-label",
      "Priority support",
    ],
  },
];

const FOUNDER: PlanCard = {
  id: "founder",
  name: "Founder",
  monthly: 99,
  setup: 199,
  description: "Premium-level access at $99/mo locked for life.",
  founderOnly: true,
  features: [
    "Unlimited locations (Premium access)",
    "All features included",
    "SMS + email campaigns",
    "Social post scheduler",
    "AI insights & analytics",
    "Multi-user team access",
    "Priority support",
    "Locked at $99/mo for life",
  ],
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function Pricing() {
  const navigate = useNavigate();
  const { organizationId } = useOrganization();
  const { isActive } = useSubscription();
  const { data: founderRemaining } = useFounderSlotsRemaining();
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const founderOpen = (founderRemaining ?? 10) > 0;

  const handlePick = (plan: PlanId) => {
    if (!isPaymentsConfigured()) {
      alert("Payments are still being set up. Please try again shortly.");
      return;
    }
    if (!organizationId) {
      navigate("/auth");
      return;
    }
    setCheckoutPlan(plan);
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />

      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {founderOpen ? "Lock in founder pricing." : "Simple pricing. No surprises."}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Monthly subscription + one-time setup fee. Both are charged at checkout. Cancel anytime.
          </p>
          {isActive && (
            <p className="mt-4 text-sm text-emerald-500">
              You already have an active subscription. <Link to="/dashboard" className="underline">Go to dashboard</Link>.
            </p>
          )}
        </div>

        {founderOpen && (
          <div className="mt-12 mx-auto max-w-lg">
            <Card className="relative overflow-hidden border-2 border-primary p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {founderRemaining} of 10 founder spots left
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-semibold">{FOUNDER.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{FOUNDER.description}</p>
                <div className="mt-6 flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold tracking-tight">{fmt(FOUNDER.monthly)}</span>
                  <span className="text-muted-foreground">/ mo</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  + {fmt(FOUNDER.setup)} one-time setup fee (charged today)
                </p>
              </div>
              <ul className="mt-8 space-y-3">
                {FOUNDER.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => handlePick("founder")} size="lg" className="mt-8 w-full">
                Claim founder spot — {fmt(FOUNDER.monthly + FOUNDER.setup)} today
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          </div>
        )}

        <div className="mt-14 grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {PLANS.map((tier) => (
            <Card
              key={tier.id}
              className={`relative flex flex-col p-8 ${tier.highlight ? "ring-2 ring-primary md:scale-[1.03]" : ""}`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-semibold">{tier.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">{fmt(tier.monthly)}</span>
                <span className="text-muted-foreground">/ mo</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                + {fmt(tier.setup)} one-time setup
              </p>
              <p className="text-xs text-muted-foreground">
                Total today: <span className="font-medium text-foreground">{fmt(tier.monthly + tier.setup)}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handlePick(tier.id)}
                className="mt-8 w-full"
                size="lg"
                variant={tier.highlight ? "default" : "outline"}
              >
                Start with {tier.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!checkoutPlan} onOpenChange={(open) => !open && setCheckoutPlan(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <button
            onClick={() => setCheckoutPlan(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-background/80 p-2 hover:bg-background"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          {checkoutPlan && organizationId && (
            <StripeEmbeddedCheckout plan={checkoutPlan} organizationId={organizationId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
