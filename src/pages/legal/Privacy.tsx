import { useEffect, useMemo, useState } from "react";
import { PageSEO } from "@/components/PageSEO";

import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ScrollText, Mail, Lock, Globe2, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const lastUpdated = new Date().toLocaleDateString(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const CA_BUSINESS = {
  legalName: "Maximum AI Consulting LLC",
  dba: "Maximum Social",
  state: "California, USA",
  region: "San Francisco Bay Area, California",
  county: "San Francisco County, California",
  email: "support@maximumaiconsulting.com",
};

const privacySections: Section[] = [
  {
    id: "about-us",
    title: "1. About Us",
    body: (
      <p>
        {CA_BUSINESS.dba} is operated by {CA_BUSINESS.legalName}, a business organized and
        headquartered in the State of {CA_BUSINESS.state}. This Privacy Policy is governed by
        California law and is designed to comply with the California Consumer Privacy Act
        ("CCPA"), the California Privacy Rights Act ("CPRA"), the California Online Privacy
        Protection Act ("CalOPPA"), and California's "Shine the Light" law (Civil Code §1798.83).
      </p>
    ),
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    body: (
      <>
        <p>In the past 12 months we have collected the following categories of personal information
        as defined by the CCPA/CPRA:</p>
        <ul className="space-y-2 list-disc pl-5 mt-3">
          <li><strong>Identifiers:</strong> name, email, phone number, IP address, account ID.</li>
          <li><strong>Customer records (Cal. Civ. Code §1798.80):</strong> billing address, payment information (handled by Stripe).</li>
          <li><strong>Commercial information:</strong> subscription plan, purchase history.</li>
          <li><strong>Internet/network activity:</strong> log events, browser & device info, pages visited, referring URLs.</li>
          <li><strong>Geolocation data:</strong> approximate location derived from IP address.</li>
          <li><strong>Customer-uploaded data:</strong> contacts (name, email, phone), campaign content, feedback responses you upload to operate your account.</li>
          <li><strong>Inferences:</strong> usage patterns and preferences to improve the Service.</li>
        </ul>
        <p className="mt-3">We do <strong>not</strong> collect sensitive personal information as
        defined under the CPRA, and we do not knowingly collect information from minors under 16.</p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How We Use Information",
    body: (
      <ul className="space-y-2 list-disc pl-5">
        <li>To provide, maintain, and improve the Service.</li>
        <li>To process payments and manage subscriptions.</li>
        <li>To send transactional and (with consent) marketing communications.</li>
        <li>To detect abuse, fraud, and ensure security.</li>
        <li>To comply with legal obligations under California and federal law.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "4. Sharing & Sub-processors",
    body: (
      <>
        <p>We share data only with vetted service providers (as defined under the CCPA) who are
        contractually restricted from using the data for any purpose other than providing services
        to us:</p>
        <ul className="space-y-2 list-disc pl-5 mt-3">
          <li><strong>Supabase</strong> — database, authentication, file storage.</li>
          <li><strong>Stripe</strong> — payment processing.</li>
          <li><strong>Twilio</strong> — SMS delivery.</li>
          <li><strong>Resend / email provider</strong> — transactional email delivery.</li>
        </ul>
        <p className="mt-3 font-medium text-foreground">
          We do not sell or share your personal information for cross-context behavioral
          advertising as those terms are defined under the CCPA/CPRA. Because we do not sell or
          share, we do not currently process Global Privacy Control ("GPC") signals as opt-out
          requests, but we honor them where applicable.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "5. Data Retention",
    body: (
      <p>
        We retain account and customer data for as long as your account is active. After
        termination, data is deleted within 90 days unless a longer retention period is required
        by California or federal law (e.g., tax, accounting, or fraud-prevention obligations).
      </p>
    ),
  },
  {
    id: "ccpa-rights",
    title: "6. Your California Privacy Rights (CCPA / CPRA)",
    body: (
      <>
        <p>If you are a California resident, you have the right to:</p>
        <ul className="space-y-2 list-disc pl-5 mt-3">
          <li><strong>Know</strong> what personal information we collect, use, and disclose.</li>
          <li><strong>Access / Portability</strong> — request a copy of your personal information.</li>
          <li><strong>Delete</strong> — request deletion of your personal information.</li>
          <li><strong>Correct</strong> — request correction of inaccurate personal information.</li>
          <li><strong>Limit use of sensitive personal information</strong> (where applicable).</li>
          <li><strong>Opt out of sale or sharing</strong> — we do not sell or share, but you may submit a request at any time.</li>
          <li><strong>Non-discrimination</strong> — we will not deny services, charge different prices, or provide a different level of service for exercising your rights.</li>
        </ul>
        <p className="mt-3">
          To exercise any right, email{" "}
          <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
            {CA_BUSINESS.email}
          </a>{" "}
          with the subject line "California Privacy Request." We will verify your identity using
          information already on file and respond within 45 days as required by law. You may use
          an authorized agent (with written permission) to submit a request.
        </p>
      </>
    ),
  },
  {
    id: "shine-the-light",
    title: '7. California "Shine the Light" Disclosure',
    body: (
      <p>
        Under California Civil Code §1798.83, California residents may request a list of categories
        of personal information disclosed to third parties for those parties' direct marketing
        purposes during the prior calendar year. We do not disclose personal information to third
        parties for their direct marketing purposes. To make a request, email{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
          {CA_BUSINESS.email}
        </a>.
      </p>
    ),
  },
  {
    id: "do-not-track",
    title: "8. Do Not Track & CalOPPA",
    body: (
      <p>
        In compliance with CalOPPA, we disclose how we respond to "Do Not Track" ("DNT") signals.
        Because no industry standard for DNT has been established, we currently do not respond to
        DNT browser signals. We do honor Global Privacy Control signals where required.
      </p>
    ),
  },
  {
    id: "minors",
    title: "9. Minors (California Business & Professions Code §22581)",
    body: (
      <p>
        The Service is not directed to children under 16, and we do not knowingly collect their
        personal information. California minors who are registered users have the right to request
        removal of content they have publicly posted; email{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
          {CA_BUSINESS.email}
        </a>{" "}
        to make such a request.
      </p>
    ),
  },
  {
    id: "security",
    title: "10. Security",
    body: (
      <p>
        Consistent with California Civil Code §1798.81.5, we implement and maintain reasonable
        security procedures and practices appropriate to the nature of the information, including
        TLS encryption in transit, encryption at rest, Row-Level Security policies, and access
        controls. In the event of a security breach affecting California residents, we will notify
        affected individuals as required by Cal. Civ. Code §1798.82.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "11. Cookies",
    body: (
      <p>
        We use essential cookies for authentication and limited analytics cookies to improve the
        Service. You can control cookies via your browser settings.
      </p>
    ),
  },
  {
    id: "international",
    title: "12. International Transfers",
    body: (
      <p>
        Our servers and operations are based in the United States. If you access the Service from
        outside the U.S., your data will be transferred to and processed in the United States. We
        rely on Standard Contractual Clauses where required.
      </p>
    ),
  },
  {
    id: "changes-privacy",
    title: "13. Changes",
    body: <p>We will post material changes here and notify you via email. Updates take effect on the date posted.</p>,
  },
  {
    id: "contact-privacy",
    title: "14. Contact",
    body: (
      <>
        <p>For privacy questions or to exercise your California rights:</p>
        <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-4 text-sm">
          <p className="font-medium text-foreground">{CA_BUSINESS.legalName}</p>
          <p>d/b/a {CA_BUSINESS.dba}</p>
          <p>{CA_BUSINESS.region}</p>
          <p className="mt-2">
            Email:{" "}
            <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
              {CA_BUSINESS.email}
            </a>
          </p>
        </div>
      </>
    ),
  },
];

const termsSections: Section[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: (
      <p>
        By accessing or using {CA_BUSINESS.dba} (the "Service"), provided by{" "}
        {CA_BUSINESS.legalName}, a company organized under the laws of the State of California
        ("Company," "we," "us"), you agree to be bound by these Terms of Service ("Terms"). If you
        do not agree, do not use the Service.
      </p>
    ),
  },
  {
    id: "service-description",
    title: "2. Service Description",
    body: (
      <p>
        {CA_BUSINESS.dba} provides reputation management tools including review request campaigns,
        contact management, feedback collection, and analytics for businesses.
      </p>
    ),
  },
  {
    id: "account",
    title: "3. Account & Eligibility",
    body: (
      <p>
        You must be at least 18 years old (the age of majority in California) and authorized to
        bind your organization. You are responsible for the security of your account credentials
        and all activity under your account.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "4. Acceptable Use",
    body: (
      <ul className="space-y-2 list-disc pl-5">
        <li>You will only contact individuals who have provided prior express consent.</li>
        <li>
          You will comply with all applicable federal and California laws, including the TCPA,
          CAN-SPAM, CCPA/CPRA, the California Consumer Legal Remedies Act, and California's
          anti-spam law (Cal. Bus. & Prof. Code §17529.5).
        </li>
        <li>You will not use the Service to send unsolicited marketing, spam, or harassing content.</li>
        <li>You will not attempt to reverse-engineer, scrape, or disrupt the Service.</li>
      </ul>
    ),
  },
  {
    id: "billing",
    title: "5. Subscription & Billing",
    body: (
      <>
        <p>
          Paid plans are billed in advance via Stripe. As required by California's Automatic
          Renewal Law (Cal. Bus. & Prof. Code §17600 et seq.), we disclose:
        </p>
        <ul className="space-y-2 list-disc pl-5 mt-3">
          <li><strong>Auto-renewal:</strong> Subscriptions automatically renew at the then-current price for the same billing period until cancelled.</li>
          <li><strong>Cancellation:</strong> You may cancel anytime from your account billing portal or by emailing {CA_BUSINESS.email}. Cancellation takes effect at the end of the current billing period.</li>
          <li><strong>Refunds:</strong> See the Refund &amp; Cancellation Policy on our pricing page. Setup fees are non-refundable once onboarding has begun.</li>
        </ul>
        <p className="mt-3">
          Sales tax will be calculated and collected where required by California or other
          applicable jurisdictions.
        </p>
      </>
    ),
  },
  {
    id: "customer-data",
    title: "6. Customer Data",
    body: (
      <p>
        You retain all rights to data you upload (contacts, feedback, etc.). You grant us a limited
        license to process this data solely to provide the Service, in accordance with our Privacy
        Policy and California law.
      </p>
    ),
  },
  {
    id: "sms",
    title: "7. SMS Messaging",
    body: (
      <p>
        When using SMS features, you certify that all recipients have provided prior express written
        consent to receive messages and that your use complies with the TCPA and California
        consumer protection laws. See our{" "}
        <Link to="/sms-consent" className="text-primary underline-offset-4 hover:underline">
          SMS Consent Disclosure
        </Link>.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "8. Disclaimers",
    body: (
      <p>
        The Service is provided "as is" and "as available" without warranties of any kind, express
        or implied, including but not limited to implied warranties of merchantability, fitness for
        a particular purpose, and non-infringement. We do not guarantee uninterrupted access or
        specific business outcomes. Some California consumers may have additional rights that
        cannot be waived; nothing in these Terms is intended to limit those rights.
      </p>
    ),
  },
  {
    id: "liability",
    title: "9. Limitation of Liability",
    body: (
      <p>
        To the maximum extent permitted by California law, our aggregate liability shall not exceed
        the amounts paid by you in the 12 months preceding the claim. Some jurisdictions, including
        California, do not allow the exclusion or limitation of certain damages; in such cases our
        liability is limited to the smallest amount permitted by law.
      </p>
    ),
  },
  {
    id: "indemnification",
    title: "10. Indemnification",
    body: (
      <p>
        You agree to indemnify and hold harmless {CA_BUSINESS.legalName} and its officers,
        directors, employees, and agents from any claims, damages, or expenses (including
        reasonable attorneys' fees) arising from your use of the Service, your Customer Data, or
        your violation of these Terms or any law.
      </p>
    ),
  },
  {
    id: "termination",
    title: "11. Termination",
    body: (
      <p>
        We may suspend or terminate your account for violations of these Terms. You may terminate
        at any time by closing your account.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "12. Governing Law & Venue",
    body: (
      <p>
        These Terms are governed by the laws of the State of California, without regard to its
        conflict-of-laws principles. The exclusive venue for any dispute not subject to arbitration
        shall be the state or federal courts located in {CA_BUSINESS.county}, and both parties
        consent to personal jurisdiction in those courts.
      </p>
    ),
  },
  {
    id: "arbitration",
    title: "13. Arbitration & Class Action Waiver",
    body: (
      <>
        <p>
          Any dispute arising out of or relating to these Terms or the Service shall be resolved by
          binding arbitration administered by JAMS in San Francisco, California, under its
          Streamlined Arbitration Rules. Judgment on the award may be entered in any court of
          competent jurisdiction.
        </p>
        <p className="mt-3 font-medium text-foreground">
          You and the Company agree that each may bring claims against the other only in your or
          its individual capacity, and not as a plaintiff or class member in any purported class
          or representative proceeding.
        </p>
        <p className="mt-3">
          <strong>30-Day Right to Opt Out:</strong> You may opt out of this arbitration agreement
          by sending written notice to {CA_BUSINESS.email} within 30 days of first accepting these
          Terms. This section does not apply to small-claims court actions or to claims that cannot
          be arbitrated under California law.
        </p>
      </>
    ),
  },
  {
    id: "ca-consumer-notice",
    title: "14. California Consumer Notice",
    body: (
      <p>
        Under California Civil Code §1789.3, California users are entitled to the following notice:
        the Complaint Assistance Unit of the Division of Consumer Services of the California
        Department of Consumer Affairs may be contacted in writing at 1625 North Market Blvd.,
        Suite N 112, Sacramento, CA 95834, or by telephone at (800) 952-5210.
      </p>
    ),
  },
  {
    id: "changes-terms",
    title: "15. Changes",
    body: (
      <p>
        We may update these Terms. Material changes will be communicated via email or in-app
        notice. Continued use of the Service after changes take effect constitutes acceptance.
      </p>
    ),
  },
  {
    id: "contact-terms",
    title: "16. Contact",
    body: (
      <>
        <p>Questions about these Terms?</p>
        <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-4 text-sm">
          <p className="font-medium text-foreground">{CA_BUSINESS.legalName}</p>
          <p>d/b/a {CA_BUSINESS.dba}</p>
          <p>{CA_BUSINESS.region}</p>
          <p className="mt-2">
            Email:{" "}
            <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
              {CA_BUSINESS.email}
            </a>
          </p>
        </div>
      </>
    ),
  },
];

const refundsSections: Section[] = [
  {
    id: "refunds-overview",
    title: "1. Overview",
    body: (
      <p>
        This Refund &amp; Cancellation Policy explains how cancellations, refunds, and billing
        disputes work for {CA_BUSINESS.dba}, operated by {CA_BUSINESS.legalName} from
        {" "}{CA_BUSINESS.state}. It supplements — and is incorporated into — our Terms of Service.
      </p>
    ),
  },
  {
    id: "refunds-14-day",
    title: "2. 14-Day Money-Back Guarantee",
    body: (
      <p>
        New subscribers may request a full refund of the <strong>first month's subscription fee</strong>
        {" "}within 14 days of the initial charge by emailing{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
          {CA_BUSINESS.email}
        </a>{" "}
        with the subject line "Refund Request." This guarantee applies once per customer per
        product.
      </p>
    ),
  },
  {
    id: "refunds-setup-fees",
    title: "3. Non-Refundable Setup Fees",
    body: (
      <p>
        One-time setup fees cover onboarding, configuration, and account provisioning labor. Setup
        fees are <strong>non-refundable once onboarding work has begun</strong>. If you cancel
        before any onboarding work has started and within the 14-day window, the setup fee is
        included in the money-back guarantee.
      </p>
    ),
  },
  {
    id: "refunds-monthly",
    title: "4. Monthly Subscriptions",
    body: (
      <p>
        Monthly subscriptions are billed in advance. After the 14-day window, monthly fees are
        non-refundable, but you may cancel at any time and will retain access through the end of
        the current billing period. No further charges will be made after cancellation.
      </p>
    ),
  },
  {
    id: "refunds-annual",
    title: "5. Annual Subscriptions",
    body: (
      <p>
        Annual subscriptions paid in advance are eligible for a pro-rated refund of the
        <strong> unused full months </strong> if cancelled after the 14-day window, less any setup
        fees and any discounts associated with annual billing. Email us to request a pro-rated
        refund; we typically process within 5–10 business days.
      </p>
    ),
  },
  {
    id: "refunds-how-to-cancel",
    title: "6. How to Cancel",
    body: (
      <ul className="space-y-2 list-disc pl-5">
        <li>
          Email{" "}
          <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
            {CA_BUSINESS.email}
          </a>{" "}
          from the address on file with the subject line "Cancel Subscription."
        </li>
      </ul>
    ),
  },
  {
    id: "refunds-effective-date",
    title: "7. When Cancellation Takes Effect",
    body: (
      <p>
        Cancellations take effect at the end of your current billing period. You will keep full
        access to the Service until that date and your account will then be downgraded. We do
        not pro-rate partial months for monthly plans.
      </p>
    ),
  },
  {
    id: "refunds-plan-changes",
    title: "8. Plan Changes (Upgrades & Downgrades)",
    body: (
      <p>
        Plan changes take effect at the start of the next billing period. Contact support to
        upgrade or downgrade your plan.
      </p>
    ),
  },
  {
    id: "refunds-failed-payments",
    title: "9. Failed Payments & Past-Due Accounts",
    body: (
      <p>
        If a renewal payment fails, Stripe will automatically retry up to three times over several
        days. We will notify you by email. If all retries fail, your subscription will be marked
        past-due and may be suspended or cancelled. You can update your payment method at any time
        in the billing portal to restore service.
      </p>
    ),
  },
  {
    id: "refunds-chargebacks",
    title: "10. Chargebacks & Payment Disputes",
    body: (
      <p>
        Please contact us before initiating a chargeback — most billing concerns can be resolved
        within 1–2 business days. Chargebacks filed without first contacting us may result in
        immediate suspension of your account pending resolution. We reserve the right to dispute
        chargebacks for charges that we believe are valid under these Terms.
      </p>
    ),
  },
  {
    id: "refunds-method",
    title: "11. Refund Method & Timing",
    body: (
      <p>
        Approved refunds are issued to the original payment method via Stripe. Refunds typically
        appear on your statement within <strong>5–10 business days</strong>, depending on your
        bank or card issuer. We do not issue refunds in cash, check, or to alternate accounts.
      </p>
    ),
  },
  {
    id: "refunds-promotional",
    title: "12. Promotional, Founder & Discounted Pricing",
    body: (
      <p>
        Promotional pricing (including the Founder plan and any discounted offers) is honored
        according to the terms of the offer at the time of purchase. If you cancel a discounted
        annual plan and later resubscribe, the original promotional pricing may no longer be
        available.
      </p>
    ),
  },
  {
    id: "refunds-no-refund-cases",
    title: "13. Situations Where Refunds Are Not Available",
    body: (
      <ul className="space-y-2 list-disc pl-5">
        <li>Setup fees once onboarding work has begun.</li>
        <li>Monthly subscription fees billed more than 14 days before the request.</li>
        <li>Accounts terminated by us for violations of the Terms of Service or Acceptable Use.</li>
        <li>SMS, email, or third-party usage fees that have already been delivered.</li>
        <li>Any portion of a billing period already consumed (other than annual pro-ration).</li>
      </ul>
    ),
  },
  {
    id: "refunds-statutory",
    title: "14. Your Statutory Consumer Rights",
    body: (
      <p>
        Nothing in this policy limits any non-waivable rights you have under California or other
        applicable consumer protection law, including the California Automatic Renewal Law
        (Cal. Bus. &amp; Prof. Code §17600 et seq.) and the Consumers Legal Remedies Act
        (Cal. Civ. Code §1750 et seq.). California residents may also contact the Complaint
        Assistance Unit of the Division of Consumer Services at 1625 North Market Blvd.,
        Suite N 112, Sacramento, CA 95834, or (800) 952-5210.
      </p>
    ),
  },
  {
    id: "refunds-contact",
    title: "15. Contact Us About a Refund or Cancellation",
    body: (
      <>
        <p>For all refund or cancellation requests:</p>
        <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-4 text-sm">
          <p className="font-medium text-foreground">{CA_BUSINESS.legalName}</p>
          <p>d/b/a {CA_BUSINESS.dba}</p>
          <p>{CA_BUSINESS.region}</p>
          <p className="mt-2">
            Email:{" "}
            <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${CA_BUSINESS.email}`}>
              {CA_BUSINESS.email}
            </a>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Subject: "Refund Request" or "Cancel Subscription"</p>
        </div>
      </>
    ),
  },
];

function SectionList({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className="scroll-mt-24 rounded-lg border border-border/60 bg-card/40 p-6 transition-colors hover:bg-card/60"
        >
          <h2 className="text-xl font-semibold tracking-tight text-foreground mb-3">{s.title}</h2>
          <div className="text-muted-foreground leading-relaxed">{s.body}</div>
        </section>
      ))}
    </div>
  );
}

function TableOfContents({
  sections,
  activeId,
}: {
  sections: Section[];
  activeId: string | null;
}) {
  return (
    <nav aria-label="Table of contents" className="space-y-1 text-sm">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`block rounded-md px-3 py-2 transition-colors ${
            activeId === s.id
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {s.title}
        </a>
      ))}
    </nav>
  );
}

type TabKey = "privacy" | "terms" | "refunds";

export default function Privacy() {
  const location = useLocation();
  const initialTab: TabKey =
    location.pathname === "/terms"
      ? "terms"
      : location.pathname === "/refunds" ||
        location.pathname === "/refund-policy" ||
        location.pathname === "/cancellation-policy"
      ? "refunds"
      : "privacy";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sections = useMemo(
    () => (tab === "privacy" ? privacySections : tab === "terms" ? termsSections : refundsSections),
    [tab]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: [0, 1] }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageSEO
        title="Privacy Policy"
        description="How Maximum Social collects, uses, and protects personal data for business users and their customers."
        path="/privacy"
      />

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-14">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <FileText className="h-3.5 w-3.5" />
                Legal
              </div>
              <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight">
                Privacy, Terms & Refunds
              </h1>
              <p className="mt-3 text-muted-foreground">
                How we collect, use, and protect your data — and the terms that govern your use of
                Maximum Social. Operated from California, USA.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <a href="mailto:support@maximumaiconsulting.com">
                  <Mail className="h-4 w-4" />
                  Contact Legal
                </a>
              </Button>
            </div>
          </div>

          {/* Trust strip */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Lock, label: "Encrypted in transit & at rest" },
              { icon: ShieldCheck, label: "CCPA / CPRA compliant — California business" },
              { icon: Globe2, label: "We never sell your data" },
            ].map(({ icon: Icon, label }) => (
              <Card key={label} className="flex items-center gap-3 px-4 py-3 bg-card/60 backdrop-blur">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-foreground">{label}</span>
              </Card>
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="mb-8">
            <TabsTrigger value="privacy" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Privacy Policy
            </TabsTrigger>
            <TabsTrigger value="terms" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Terms of Service
            </TabsTrigger>
            <TabsTrigger value="refunds" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refunds & Cancellation
            </TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
            {/* TOC */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  On this page
                </p>
                <TableOfContents sections={sections} activeId={activeId} />
              </div>
            </aside>

            {/* Content */}
            <div>
              <TabsContent value="privacy" className="mt-0">
                <SectionList sections={privacySections} />
              </TabsContent>
              <TabsContent value="terms" className="mt-0">
                <SectionList sections={termsSections} />
              </TabsContent>
              <TabsContent value="refunds" className="mt-0">
                <SectionList sections={refundsSections} />
              </TabsContent>

              <Separator className="my-12" />

              <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Have a question about this document? We're happy to help.
                </p>
                <Button asChild className="mt-4">
                  <a href="mailto:support@maximumaiconsulting.com">
                    <Mail className="h-4 w-4" />
                    support@maximumaiconsulting.com
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
