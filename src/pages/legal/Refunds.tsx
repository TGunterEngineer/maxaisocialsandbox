import { Link } from "react-router-dom";
import { PageSEO } from "@/components/PageSEO";

export default function Refunds() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageSEO
        title="Refund & Cancellation Policy"
        description="Subscription billing, cancellation, and refund rules for Maximum Social monthly and annual plans."
        path="/refunds"
      />
      <div className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary">
        <Link to="/" className="text-sm text-primary hover:underline">← Back</Link>

        <h1>Refund & Cancellation Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>1. Subscription Billing</h2>
        <p>
          Maximum Social subscriptions are billed in advance on a monthly or annual cycle through our
          payment processor (Stripe). Charges renew automatically until you cancel.
        </p>

        <h2>2. Cancellation</h2>
        <p>
          You may cancel your subscription at any time from{" "}
          <Link to="/billing">Billing</Link>. Cancellation takes effect at the end of the current
          billing period — you keep access to paid features until that date, after which your account
          downgrades to a free tier.
        </p>
        <ul>
          <li>No partial-period refunds for monthly plans.</li>
          <li>Annual plans cancelled mid-term remain active through the paid period.</li>
          <li>You can re-subscribe at any time without losing your data.</li>
        </ul>

        <h2>3. Refund Eligibility</h2>
        <p>Refunds are issued only in the following cases:</p>
        <ul>
          <li><strong>Duplicate charge</strong> — billed twice for the same period due to a system error.</li>
          <li><strong>Service unavailable</strong> — the platform was inaccessible for more than 72 consecutive hours due to our fault.</li>
          <li><strong>Required by law</strong> — including statutory consumer protections in your jurisdiction.</li>
        </ul>
        <p>
          Charges for SMS, AI generation, or other usage-based add-ons are non-refundable once consumed.
        </p>

        <h2>4. Founder Plan</h2>
        <p>
          Founder plan purchases are final and non-refundable due to the limited-quantity, lifetime-discount
          nature of the offer. You retain the founder rate for the lifetime of your subscription provided you
          maintain continuous billing.
        </p>

        <h2>5. How to Request a Refund</h2>
        <p>
          Email <a href="mailto:support@maximumaiconsulting.com">support@maximumaiconsulting.com</a> within
          30 days of the charge with your account email and the invoice ID. Eligible refunds are processed
          within 5–10 business days back to the original payment method.
        </p>

        <h2>6. Chargebacks</h2>
        <p>
          Please contact us before initiating a chargeback. Disputes filed without prior contact may result
          in immediate account suspension and forfeit of stored data.
        </p>

        <h2>7. Changes</h2>
        <p>
          We may update this policy. Material changes will be communicated via email or in-app notice and
          will not apply retroactively to charges already made.
        </p>

        <h2>8. Contact</h2>
        <p>
          Questions about a charge? Email{" "}
          <a href="mailto:support@maximumaiconsulting.com">support@maximumaiconsulting.com</a>.
        </p>
      </div>
    </div>
  );
}
