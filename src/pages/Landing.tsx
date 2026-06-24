import { useEffect } from "react";
import { PageSEO } from "@/components/PageSEO";

import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Sparkles,
  Zap,
  Star,
  Inbox,
  MessageSquare,
  BarChart3,
  Megaphone,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFounderSlotsRemaining } from "@/hooks/useSubscription";

const FEATURES = [
  {
    icon: Inbox,
    title: "Unified review inbox",
    desc: "Google, Facebook, Instagram and more — every review and mention in one place.",
  },
  {
    icon: Sparkles,
    title: "AI replies in your voice",
    desc: "On-brand responses generated from your tone and brand voice — approve in one click.",
  },
  {
    icon: Star,
    title: "Smart review requests",
    desc: "SMS + email campaigns route happy customers to public reviews and unhappy ones to private feedback.",
  },
  {
    icon: Calendar,
    title: "Social post scheduler",
    desc: "Plan, generate and schedule posts across channels with an AI-powered content calendar.",
  },
  {
    icon: BarChart3,
    title: "Analytics & AI insights",
    desc: "Rating trends, sentiment breakdowns, and weekly insights that tell you exactly what to fix.",
  },
  {
    icon: Zap,
    title: "Live in under 10 minutes",
    desc: "Self-serve onboarding. No sales call, no IT ticket, no developer.",
  },
];

const PRICING = [
  {
    name: "Essential",
    monthly: 99,
    setup: 199,
    features: [
      "1 location",
      "Unified review inbox",
      "AI reply drafts",
      "Basic review requests",
      "Email support",
    ],
  },
  {
    name: "Growth",
    monthly: 199,
    setup: 399,
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
    name: "Premium",
    monthly: 399,
    setup: 799,
    features: [
      "Unlimited locations",
      "Everything in Growth",
      "Multi-user team access",
      "Branding & white-label",
      "Priority support",
    ],
  },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export default function Landing() {
  const navigate = useNavigate();
  const { data: founderRemaining } = useFounderSlotsRemaining();
  const total = 10;
  const remaining = founderRemaining ?? total;
  const founderOpen = remaining > 0;

  useEffect(() => {
    document.title = "Maximum Social — AI review & social inbox for local business";
    const desc =
      "Manage every review, comment and mention in one inbox. AI replies in your voice, smart review requests, and a social scheduler — live in 10 minutes.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  const primaryCta = "/auth";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <PageSEO
        title="Reputation & customer engagement for local businesses"
        description="Monitor reviews, request more 5-stars, route bad ratings privately, and grow with AI-powered SMS, email, and content campaigns."
        path="/landing"
      />

      {/* Background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500">
              <MessageSquare className="h-4 w-4 text-[#0a0a0f]" />
            </div>
            <span className="font-semibold tracking-tight">Maximum Social</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#how" className="hover:text-white">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/demo">
              <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/5 hover:text-white">
                Try the demo
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/5 hover:text-white">
                Client login
              </Button>
            </Link>
            <Link to={primaryCta}>
              <Button
                size="sm"
                className="bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#0a0a0f] hover:opacity-90"
              >
                {founderOpen ? "Claim founder spot" : "Get started"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-emerald-300">
          <Sparkles className="h-3 w-3" />
          AI review & social inbox for local business
        </div>
        <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Win every review — <br />
          <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
            on every channel.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
          One inbox for Google, Facebook, Instagram and more. AI replies in your brand voice,
          smart review requests, and a social scheduler — so reputation runs itself.
        </p>
        {founderOpen && (
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Only {remaining} of {total} founder spots left — Premium access at $99/mo locked for life
          </div>
        )}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={() => navigate("/demo")}
            className="bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#0a0a0f] hover:opacity-90"
          >
            Try the demo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/auth")}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            Client login
          </Button>
        </div>
        <p className="mt-4 text-xs text-white/70">
          {founderOpen ? "Cancel anytime · Founder rate never increases" : "Cancel anytime"}
        </p>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Everything you need to <br />
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              own your reputation.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            Built for local businesses, multi-location brands, and agencies that live or die by online reputation.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card
              key={f.title}
              className="border-white/10 bg-white/[0.03] p-6 transition-all hover:bg-white/[0.05]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 ring-1 ring-emerald-400/30">
                <f.icon className="h-5 w-5 text-emerald-300" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">3 steps. 10 minutes.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            From signup to a fully automated review pipeline, faster than your morning coffee.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { n: "01", t: "Connect your sources", d: "Hook up Google, Facebook, Instagram and your contact list." },
            { n: "02", t: "Set your brand voice", d: "Train the AI on your tone so every reply sounds like you." },
            { n: "03", t: "Launch campaigns", d: "Send review requests and schedule posts — sit back and monitor." },
          ].map((s) => (
            <Card key={s.n} className="border-white/10 bg-white/[0.03] p-6">
              <div className="text-sm font-mono text-emerald-300">{s.n}</div>
              <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-white/60">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            {founderOpen ? "Lock in founder pricing." : "Simple pricing. No surprises."}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            {founderOpen
              ? `Only the first ${total} customers get Premium access at Essential pricing — $99/mo locked for life. After that, choose any of our 3 standard tiers.`
              : "Monthly subscription + one-time setup fee. Cancel anytime."}
          </p>
        </div>

        {founderOpen && (
          <div className="mt-14 mx-auto max-w-lg">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-400 to-cyan-400 p-[2px] shadow-[0_0_60px_-15px_rgba(16,185,129,0.5)]">
              <div className="relative rounded-lg bg-[#0a0a0f] p-8">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-400/20 via-transparent to-cyan-400/20" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-1 text-xs font-semibold text-[#0a0a0f]">
                  {`${remaining} of ${total} spots left`}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-semibold">Founder</h3>
                  <div className="mt-6 flex items-baseline justify-center gap-2">
                    <span className="text-6xl font-bold tracking-tight">$99</span>
                    <span className="text-white/50">/ mo</span>
                  </div>
                  <p className="mt-2 text-sm text-white/50">+ $199 one-time setup · Premium access locked for life</p>
                </div>
                <ul className="mt-8 space-y-3">
                  {[
                    "Unlimited locations (Premium access)",
                    "Unified review inbox",
                    "AI replies in your brand voice",
                    "SMS + email review campaigns",
                    "Social post scheduler",
                    "AI insights & analytics",
                    "Multi-user team access",
                    "Priority support",
                    "Locked at $99/mo for life",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-white/80">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate(primaryCta)}
                  size="lg"
                  className="mt-8 w-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#0a0a0f] hover:opacity-90"
                >
                  Claim your founder spot
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        <div className="mt-14 grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {PRICING.map((tier) => (
            <Card
              key={tier.name}
              className={`relative flex flex-col border-white/10 bg-white/[0.03] p-8 transition-all hover:bg-white/[0.05] ${
                tier.highlight ? "ring-2 ring-emerald-400/60 md:scale-[1.03]" : ""
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-1 text-xs font-semibold text-[#0a0a0f]">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-semibold">{tier.name}</h3>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight">{formatCurrency(tier.monthly)}</span>
                <span className="text-white/50">/ mo</span>
              </div>
              <p className="mt-2 text-sm text-white/50">+ {formatCurrency(tier.setup)} one-time setup</p>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/80">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate(primaryCta)}
                className={`mt-8 w-full ${
                  tier.highlight
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#0a0a0f] hover:opacity-90"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                size="lg"
              >
                Start with {tier.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <Card className="border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-10 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-emerald-300" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Your competitors ignore reviews. You don't.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            {founderOpen
              ? `${remaining} founder spots left — Premium access at $99/mo locked for life. Once they're gone, gone.`
              : "Be live on every review channel before your next coffee break."}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate("/demo")}
              className="bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#0a0a0f] hover:opacity-90"
            >
              Try the demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Client login
            </Button>
            <Link to={primaryCta}>
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/5">
                {founderOpen ? "Claim founder spot" : "Get started"}
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-white/40">
        <div>© {new Date().getFullYear()} MaximumAI Consulting. All rights reserved.</div>
        <div className="mt-2 space-x-4">
          <a href="#features" className="hover:text-white/70 underline-offset-4 hover:underline">
            Features
          </a>
          <a href="#pricing" className="hover:text-white/70 underline-offset-4 hover:underline">
            Pricing
          </a>
          <Link to="/auth" className="hover:text-white/70 underline-offset-4 hover:underline">
            Client login
          </Link>
          <Link to="/privacy" className="hover:text-white/70 underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-white/70 underline-offset-4 hover:underline">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
