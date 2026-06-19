import { Helmet } from "react-helmet-async";
import { PageSEO } from "@/components/PageSEO";
import { Link } from "react-router-dom";
import {
  Star,
  MapPin,
  MessageSquare,
  TrendingUp,
  ShieldCheck,
  Bell,
  Smartphone,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STEPS = [
  {
    icon: MapPin,
    title: "Claim & Optimize Your Google Business Profile",
    description:
      "Start by claiming your Google Business Profile (formerly Google My Business). Fill out every field — hours, services, photos, and a keyword-rich description. A complete profile ranks higher in local search and appears in the Local Pack.",
    tips: [
      "Use your primary category wisely (e.g., 'Plumber' not 'Service Business').",
      "Upload at least 10 high-quality photos of your work and team.",
      "Post weekly updates — Google favors active profiles.",
    ],
  },
  {
    icon: Star,
    title: "Build a Proactive Review Request System",
    description:
      "Don't wait for reviews to happen. The best local businesses ask happy customers at the right moment — immediately after a positive interaction. A simple SMS or email with a direct link to your Google or Facebook review page makes it effortless.",
    tips: [
      "Ask within 24 hours while the experience is fresh.",
      "Use SMS for higher open rates (98% vs. 20% for email).",
      "Provide a direct link — every extra click loses 50% of reviewers.",
    ],
  },
  {
    icon: MessageSquare,
    title: "Respond to Every Review — Fast",
    description:
      "Replying to reviews shows prospects you care. For positive reviews, a personalized thank-you builds loyalty. For negative reviews, a professional, empathetic response can turn a critic into an advocate and signals to readers that you stand behind your work.",
    tips: [
      "Aim to respond within 24–48 hours.",
      "Acknowledge the specific issue before offering a resolution.",
      "Take detailed conversations offline when appropriate.",
    ],
  },
  {
    icon: Bell,
    title: "Monitor Mentions Across Platforms",
    description:
      "Reviews live on Google, Facebook, Yelp, TripAdvisor, industry-specific sites, and social media. You can't fix what you don't see. Set up alerts and use a unified inbox so no mention slips through the cracks.",
    tips: [
      "Enable notifications for all review platforms.",
      "Use a unified dashboard to track Google, Facebook, and Instagram in one place.",
      "Watch for mentions on Nextdoor and local Facebook groups, too.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Flag & Remove Fake or Defamatory Reviews",
    description:
      "Not every review is fair. Competitors, bots, and disgruntled non-customers sometimes leave fraudulent feedback. Both Google and Facebook have reporting processes. Document your case clearly and follow up if the first request is denied.",
    tips: [
      "Screenshot the review and gather evidence it violates platform policies.",
      "Report through Google's 'Report Review' tool or Facebook's support.",
      "Build a pattern of genuine positive reviews to dilute the impact of fakes.",
    ],
  },
  {
    icon: TrendingUp,
    title: "Turn Feedback Into Operational Improvements",
    description:
      "Reviews are free market research. Recurring complaints about wait times, pricing, or communication are signals to improve. Share insights with your team and close the loop by updating reviewers when you've fixed the issue.",
    tips: [
      "Track common complaint themes monthly.",
      "Set internal KPIs tied to review sentiment.",
      "Update reviewers who reported resolved issues — it shows you listen.",
    ],
  },
];

const FAQS = [
  {
    question: "What is online reputation management for local businesses?",
    answer:
      "Online reputation management (ORM) for local businesses is the practice of monitoring, influencing, and improving how your business appears online — primarily through reviews on Google, Facebook, Yelp, and other platforms. It involves collecting positive reviews, responding to feedback, and addressing negative mentions to build trust with potential customers in your area.",
  },
  {
    question: "Why do local businesses need reputation management services?",
    answer:
      "Local businesses rely heavily on proximity-based search results and word-of-mouth. A single negative review on Google can cost you dozens of potential customers. Reputation management services help you proactively build a strong review profile, respond professionally to criticism, and ensure your online presence reflects the quality of your actual service.",
  },
  {
    question: "How do I get more Google reviews for my local business?",
    answer:
      "The most effective strategy is asking satisfied customers directly, ideally via SMS, within 24 hours of their visit. Provide a direct link to your Google review page, keep the message short and personal, and make the process as frictionless as possible. Automated review request campaigns can scale this without feeling impersonal.",
  },
  {
    question: "Should I respond to negative reviews?",
    answer:
      "Yes — always. A thoughtful, professional response to a negative review shows prospective customers that you care about service quality. Acknowledge the issue, apologize if appropriate, explain any context without being defensive, and offer to make it right. Many readers will judge your business more by your response than by the complaint itself.",
  },
  {
    question: "How long does it take to improve a business's online reputation?",
    answer:
      "With consistent effort, you can see meaningful improvement in 30–60 days. The key is generating a steady stream of new, authentic positive reviews while addressing negative feedback promptly. Platforms like Google weight recent reviews more heavily, so consistent activity matters more than one-time campaigns.",
  },
  {
    question: "Can I remove a fake review from Google or Facebook?",
    answer:
      "You can report reviews that violate platform policies — such as spam, fake accounts, off-topic content, or conflicts of interest. Google and Facebook review each report individually. Success rates vary, so the best defense is a strong offense: build so many genuine positive reviews that a single fake one has minimal impact.",
  },
];

export default function ReputationManagementGuide() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <PageSEO
        title="Reputation Management for Local Businesses — A Complete Guide"
        description="Learn how local businesses can manage reviews on Google & Facebook, build trust, and turn feedback into growth. Actionable steps + free tools inside."
        path="/guides/reputation-management-for-local-business"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        {/* Nav */}
        <header className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/landing" className="font-semibold text-lg tracking-tight">
              Maximum Social
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/landing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Home
              </Link>
              <Button asChild size="sm">
                <Link to="/landing">Get Started</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          {/* Hero */}
          <article>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Lightbulb className="h-3.5 w-3.5" />
              Local Business Guide
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Reputation Management for Local Businesses:
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mt-2">
                A Complete Guide to Winning Online Reviews
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed mb-8">
              Online reputation management isn't just for big brands. For local businesses, your Google and Facebook reviews are often the first impression potential customers get. This guide walks you through proven, actionable steps to build, protect, and leverage your reputation — turning happy customers into your most powerful marketing channel.
            </p>

            {/* Jump links */}
            <div className="flex flex-wrap gap-2 mb-16">
              {STEPS.map((s, i) => (
                <a
                  key={i}
                  href={`#step-${i + 1}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {i + 1}. {s.title}
                </a>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-20">
              {STEPS.map((step, i) => (
                <section key={i} id={`step-${i + 1}`} className="scroll-mt-24">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-primary/20">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-1 block">
                        Step {i + 1}
                      </span>
                      <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        {step.title}
                      </h2>
                    </div>
                  </div>
                  <div className="ml-14">
                    <p className="text-muted-foreground leading-relaxed mb-5">
                      {step.description}
                    </p>
                    <div className="rounded-xl border border-border bg-card/50 p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Actionable Tips
                      </h3>
                      <ul className="space-y-2.5">
                        {step.tips.map((tip, j) => (
                          <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                            <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            {/* Divider + CTA */}
            <div className="my-20 border-t border-border" />

            <section className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                Ready to Automate Your Reputation Management?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
                Maximum Social helps local businesses collect more reviews, reply with AI-generated responses in their brand voice, and monitor every mention — all from one unified inbox. No spreadsheets, no manual copy-paste.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="min-w-[200px]">
                  <Link to="/landing">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-w-[200px]">
                  <Link to="/demo">View Live Demo</Link>
                </Button>
              </div>
            </section>

            {/* FAQ */}
            <section className="mt-20">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                {FAQS.map((faq, i) => (
                  <Card key={i} className="p-6 border-border bg-card/50">
                    <h3 className="font-semibold text-foreground mb-2 flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-1" />
                      {faq.question}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed ml-7">
                      {faq.answer}
                    </p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Related / internal links */}
            <section className="mt-16">
              <h2 className="text-xl font-semibold tracking-tight mb-4">
                Related Resources
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Link
                  to="/landing"
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4 hover:border-primary/30 transition-colors"
                >
                  <Smartphone className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      Review Request Campaigns
                    </span>
                    <p className="text-xs text-muted-foreground">SMS + email outreach that routes happy customers to Google reviews</p>
                  </div>
                </Link>
                <Link
                  to="/landing"
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4 hover:border-primary/30 transition-colors"
                >
                  <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      Analytics & AI Insights
                    </span>
                    <p className="text-xs text-muted-foreground">Track rating trends and sentiment across all your locations</p>
                  </div>
                </Link>
              </div>
            </section>
          </article>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>© {new Date().getFullYear()} Maximum Social. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link to="/sms-consent" className="hover:text-foreground transition-colors">SMS Consent</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
