import { Link } from "react-router-dom";
import { PageSEO } from "@/components/PageSEO";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageSEO
        title="Terms of Service"
        description="Terms governing use of Maximum Social — accounts, acceptable use, billing, and liability."
        path="/terms"
      />
      <div className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary">
        <Link to="/" className="text-sm text-primary hover:underline">← Back</Link>

        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Maximum Social ("Service"), you agree to be bound by these Terms of
          Service. If you do not agree, do not use the Service.
        </p>

        <h2>2. Service Description</h2>
        <p>
          Maximum Social provides reputation management tools including review request campaigns,
          contact management, feedback collection, and analytics for businesses.
        </p>

        <h2>3. Account & Eligibility</h2>
        <p>
          You must be at least 18 years old and authorized to bind your organization. You are
          responsible for the security of your account credentials and all activity under your account.
        </p>

        <h2>4. Acceptable Use</h2>
        <ul>
          <li>You will only contact individuals who have provided prior express consent.</li>
          <li>You will comply with all applicable laws including the TCPA, CAN-SPAM, GDPR, and CCPA.</li>
          <li>You will not use the Service to send unsolicited marketing, spam, or harassing content.</li>
          <li>You will not attempt to reverse-engineer, scrape, or disrupt the Service.</li>
        </ul>

        <h2>5. Subscription & Billing</h2>
        <p>
          Paid plans are billed in advance via Stripe. Fees are non-refundable except where required by
          law. You may cancel at any time; access continues until the end of your billing period.
        </p>

        <h2>6. Customer Data</h2>
        <p>
          You retain all rights to data you upload (contacts, feedback, etc.). You grant us a limited
          license to process this data solely to provide the Service. See our{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>7. SMS Messaging</h2>
        <p>
          When using SMS features, you certify that all recipients have provided prior express written
          consent to receive messages. See our <Link to="/sms-consent">SMS Consent Disclosure</Link>.
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted
          access or specific business outcomes.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, our aggregate liability shall not exceed the amounts paid
          by you in the 12 months preceding the claim.
        </p>

        <h2>10. Termination</h2>
        <p>
          We may suspend or terminate your account for violations of these Terms. You may terminate at any
          time by closing your account.
        </p>

        <h2>11. Changes</h2>
        <p>
          We may update these Terms. Material changes will be communicated via email or in-app notice.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions? Email <a href="mailto:support@maximumaiconsulting.com">support@maximumaiconsulting.com</a>.
        </p>
      </div>
    </div>
  );
}
