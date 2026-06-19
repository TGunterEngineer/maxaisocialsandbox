// Exclusive SuperAdmin demo data themed around maximumaiconsulting.com
// All data is fake — used only to showcase the premium feature surface.

import type { Platform } from "@/components/PlatformIcon";

export const MAX_AI_BRAND = {
  name: "Maximum AI Consulting",
  domain: "maximumaiconsulting.com",
  url: "https://maximumaiconsulting.com",
  tagline: "AI strategy & automation for ambitious operators",
  primaryColor: "#6366F1",
  googleReviewUrl: "https://maximumaiconsulting.com/review",
  city: "Chicago, IL",
};

export type DemoSentiment = "positive" | "neutral" | "negative";

export interface DemoReview {
  id: string;
  customerName: string;
  platform: Platform;
  rating?: number;
  kind: "review" | "comment" | "mention";
  text: string;
  suggestedReply: string;
  date: string;
  sentiment: DemoSentiment;
  status: "new" | "replied" | "escalated";
}

export const maxAiReviews: DemoReview[] = [
  {
    id: "r1",
    customerName: "Daniel Okafor",
    platform: "google",
    rating: 5,
    kind: "review",
    text: "Maximum AI Consulting rebuilt our lead-gen funnel in six weeks. Booked calls are up 312% and our SDRs finally have qualified pipeline. Worth every dollar.",
    suggestedReply:
      "Daniel — thank you! 🚀 312% on booked calls is a phenomenal outcome and your team did the hard work of executing fast. Excited for what Q3 brings.",
    date: "2h ago",
    sentiment: "positive",
    status: "new",
  },
  {
    id: "r2",
    customerName: "Priya Raman",
    platform: "google",
    rating: 5,
    kind: "review",
    text: "Hired them to audit our GPT workflows. Cut our OpenAI bill by 47% and shipped two new automations in the same engagement. Best consulting investment of the year.",
    suggestedReply:
      "Priya, this means a lot. A 47% spend reduction AND new automations is the exact win we aim for. Looking forward to phase two with your ops team!",
    date: "5h ago",
    sentiment: "positive",
    status: "replied",
  },
  {
    id: "r3",
    customerName: "Marcus Whitfield",
    platform: "google",
    rating: 2,
    kind: "review",
    text: "Discovery call was great but timeline slipped by three weeks. Communication during the build phase could be much better — we were chasing updates.",
    suggestedReply:
      "Marcus, I appreciate the candid feedback and you're right — the comms cadence on your build dropped below our standard. I'd like to personally walk through a recovery plan. Reaching out by email today.",
    date: "1d ago",
    sentiment: "negative",
    status: "escalated",
  },
  {
    id: "r4",
    customerName: "Lena Brooks",
    platform: "yelp",
    rating: 5,
    kind: "review",
    text: "Maximum AI built us a Claude-powered intake agent that handles 80% of new client questions overnight. Our intake coordinator finally has her evenings back.",
    suggestedReply:
      "Lena — giving your team their evenings back is the kind of outcome we love. Thank you for trusting us with the intake workflow!",
    date: "2d ago",
    sentiment: "positive",
    status: "new",
  },
  {
    id: "@5",
    customerName: "@growth.with.theo",
    platform: "instagram",
    kind: "mention",
    text: "If you're a founder still doing manual sales ops in 2026, talk to @maximumaiconsulting. They rewired our whole pipeline in a month. 🤖💸",
    suggestedReply:
      "Theo, appreciate the shoutout! 🙌 Your team brought the rigor — we just gave the rigor better tools. Let's grab coffee in Chicago soon.",
    date: "3d ago",
    sentiment: "positive",
    status: "new",
  },
  {
    id: "c6",
    customerName: "@sara.builds",
    platform: "facebook",
    kind: "comment",
    text: "Do you work with sub-20 person SaaS teams or only enterprise? Pricing page wasn't 100% clear.",
    suggestedReply:
      "Hey Sara! Yes — we run a focused 'AI Sprint' package designed for SaaS teams under 20. I'll DM you the breakdown and a Calendly link.",
    date: "4d ago",
    sentiment: "neutral",
    status: "new",
  },
  {
    id: "r7",
    customerName: "Jonas Eklund",
    platform: "google",
    rating: 4,
    kind: "review",
    text: "Strong strategy work and the automation roadmap is solid. Would love more async video updates between sessions — that's the only nit.",
    suggestedReply:
      "Jonas, thank you — and noted on async video updates. Rolling those into all engagements starting this month. Glad the roadmap is landing.",
    date: "5d ago",
    sentiment: "positive",
    status: "replied",
  },
  {
    id: "r8",
    customerName: "Aisha Khan",
    platform: "google",
    rating: 5,
    kind: "review",
    text: "Best investment our agency made this year. They redesigned our proposal workflow with AI and we're closing deals 2x faster.",
    suggestedReply:
      "Aisha — 2x close rate is a serious unlock. Thank you for the kind words and for being a phenomenal partner to work with!",
    date: "1w ago",
    sentiment: "positive",
    status: "replied",
  },
];

export const maxAiStats = {
  avgRating: 4.7,
  totalReviews: 184,
  monthReviews: 27,
  responseRate: 98,
  sentimentTrend: 14, // %
  pipelineValueUsd: 142000,
};

// 12 weeks of avg rating trend
export const maxAiTrend = [4.1, 4.2, 4.2, 4.3, 4.4, 4.4, 4.5, 4.5, 4.6, 4.6, 4.7, 4.7];

export const maxAiCampaigns = [
  {
    id: "c1",
    name: "Q2 Closed-Won Review Drive",
    channel: "email" as const,
    status: "active" as const,
    sent: 128,
    opened: 96,
    rated: 41,
    fiveStar: 33,
  },
  {
    id: "c2",
    name: "Discovery-Call No-Show Win-back",
    channel: "sms" as const,
    status: "active" as const,
    sent: 64,
    opened: 58,
    rated: 12,
    fiveStar: 9,
  },
  {
    id: "c3",
    name: "Annual Client NPS Pulse",
    channel: "email" as const,
    status: "scheduled" as const,
    sent: 0,
    opened: 0,
    rated: 0,
    fiveStar: 0,
  },
];

export const maxAiFeedback = [
  {
    id: "f1",
    name: "Tomas R.",
    rating: 2,
    text: "Onboarding doc was thorough but the kickoff meeting felt rushed. Would have liked more time on goal-setting.",
    when: "yesterday",
  },
  {
    id: "f2",
    name: "Vanessa L.",
    rating: 3,
    text: "Loved the strategy phase. Implementation phase felt like a different team — would tighten the handoff.",
    when: "3 days ago",
  },
  {
    id: "f3",
    name: "Mike A.",
    rating: 1,
    text: "Slack response time was 24+ hours during the build. For the price point I expected same-day.",
    when: "5 days ago",
  },
];

export const maxAiInsights = [
  {
    id: "i1",
    title: "Implementation handoff is the #1 friction point",
    body: "4 of the last 12 sub-4-star reviews specifically mention the strategy → build handoff. Recommend a 30-min joint session before kickoff to align scope and comms cadence.",
    severity: "high" as const,
  },
  {
    id: "i2",
    title: "Async video updates would lift CSAT",
    body: "3 separate reviewers requested async video updates between sessions. Looms during build phase are a low-cost intervention with high perceived value.",
    severity: "medium" as const,
  },
  {
    id: "i3",
    title: "AI cost reduction is your highest-converting proof point",
    body: "Reviews mentioning concrete % cost savings drove 38% more profile clicks last quarter. Lead with the 'cut OpenAI spend by 47%' case study on the homepage.",
    severity: "low" as const,
  },
];

export const maxAiWebhooks = [
  {
    id: "w1",
    name: "Slack — #wins channel",
    url: "https://hooks.slack.com/services/T0XXXX/B0XXXX/...",
    events: ["rating.submitted", "review.created"] as const,
    deliveries24h: 12,
    successRate: 100,
  },
  {
    id: "w2",
    name: "Zapier — HubSpot Deal Updater",
    url: "https://hooks.zapier.com/hooks/catch/12345/...",
    events: ["review.created", "feedback.received"] as const,
    deliveries24h: 6,
    successRate: 100,
  },
  {
    id: "w3",
    name: "Make.com — Negative review escalation",
    url: "https://hook.us2.make.com/abc123...",
    events: ["feedback.received"] as const,
    deliveries24h: 2,
    successRate: 100,
  },
];
