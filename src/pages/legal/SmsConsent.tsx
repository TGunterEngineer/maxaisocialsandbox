import { Link } from "react-router-dom";
import { PageSEO } from "@/components/PageSEO";

export default function SmsConsent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageSEO
        title="SMS Consent & TCPA Disclosure"
        description="SMS program disclosures, TCPA express written consent, message frequency, opt-out, and carrier rate information."
        path="/sms-consent"
      />
      <div className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary">
        <Link to="/" className="text-sm text-primary hover:underline">← Back</Link>

        <h1>SMS Consent & TCPA Disclosure</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <h2>Program Description</h2>
        <p>
          Maximum Social ("we", "our") sends transactional SMS messages on behalf of businesses
          ("Senders") to their customers ("Recipients") for the purpose of requesting reviews,
          collecting feedback, and confirming appointments.
        </p>

        <h2>Express Written Consent (TCPA)</h2>
        <p>
          By providing your mobile phone number to a Sender, you give your <strong>prior express written
          consent</strong> under the Telephone Consumer Protection Act (TCPA) to receive SMS messages from
          that Sender via Maximum Social, including messages sent using an automatic system. Consent is
          <strong> not a condition of purchase</strong>.
        </p>

        <h2>Message Frequency</h2>
        <p>Message frequency varies. You may receive up to 4 messages per month per Sender.</p>

        <h2>Message & Data Rates</h2>
        <p>Standard message and data rates may apply per your mobile carrier plan.</p>

        <h2>Opt-Out — Reply STOP</h2>
        <p>
          You can cancel SMS messages at any time by replying <strong>STOP</strong> to any message. After
          replying STOP, you will receive one confirmation message and no further messages will be sent.
        </p>

        <h2>Help — Reply HELP</h2>
        <p>
          For help, reply <strong>HELP</strong> to any message or contact{" "}
          <a href="mailto:support@maximumaiconsulting.com">support@maximumaiconsulting.com</a>.
        </p>

        <h2>Supported Carriers</h2>
        <p>
          We support all major US carriers including AT&amp;T, T-Mobile, Verizon Wireless, Sprint, Boost,
          U.S. Cellular, MetroPCS, Virgin Mobile, and Cricket. Carriers are not liable for delayed or
          undelivered messages.
        </p>

        <h2>Privacy</h2>
        <p>
          Phone numbers are used solely to deliver messages on behalf of the Sender. We do not sell or
          share phone numbers with third parties for marketing. See our{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>For Businesses Using Maximum Social</h2>
        <p>
          Senders are responsible for obtaining and documenting prior express written consent from each
          Recipient before importing their number, and for complying with the TCPA, CTIA guidelines, and
          carrier requirements (including A2P 10DLC registration for US traffic).
        </p>

        <h2>Contact</h2>
        <p>
          Maximum AI Consulting —{" "}
          <a href="mailto:support@maximumaiconsulting.com">support@maximumaiconsulting.com</a>
        </p>
      </div>
    </div>
  );
}
