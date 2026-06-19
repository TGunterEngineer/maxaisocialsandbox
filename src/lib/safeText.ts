/**
 * Safe text rendering helpers.
 *
 * Reviews and feedback come from external/untrusted sources (customers,
 * scrapers, ingest keys). React already escapes interpolated strings
 * (`{value}`), so XSS via React is not directly possible — but we still:
 *
 *   1. Strip ASCII control characters (incl. NULL, BEL, backspace) that
 *      could break terminals or downstream consumers.
 *   2. Strip any HTML-tag-shaped sequences as defense-in-depth in case a
 *      future caller renders the value with `dangerouslySetInnerHTML`.
 *   3. Cap length so a malicious payload can't blow up the DOM.
 *   4. Decode common HTML entities so we don't display literal &amp; etc.
 *
 * USE THIS for any user-generated text rendered in the dashboard:
 * review.text, feedback.feedback, contact.name when shown in cards.
 */

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const DEFAULT_MAX_LEN = 5000;

export function safeText(input: unknown, maxLen = DEFAULT_MAX_LEN): string {
  if (input == null) return "";
  const raw = String(input);
  return raw
    .replace(CONTROL_CHARS_RE, "")
    .replace(HTML_TAG_RE, "")
    .slice(0, maxLen)
    .trim();
}
