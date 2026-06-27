import "server-only";

/**
 * Reply-To address selection for outbound outreach.
 *
 * When `REPLY_INBOUND_DOMAIN` is configured AND we have a bankKey, we use a
 * plus-tagged address (`<bankKey>+reply@<domain>`) so an inbound-reply handler
 * can correlate the broker's eventual reply back to the original send. Without
 * the domain we fall back to the operator's own reply-to (passed by the
 * caller), so replies still reach a human — they just won't auto-link.
 *
 * Returns `undefined` when neither is available, which tells the caller to
 * omit `reply_to` entirely (Resend then uses the From address).
 */
export function replyAddressFor(
  bankKey?: string,
  fallbackReplyTo?: string
): string | undefined {
  const domain = process.env.REPLY_INBOUND_DOMAIN?.trim();
  const key = bankKey?.trim();
  if (domain && key) {
    // Sanitize the local-part tag: plus-tags can't contain @ or whitespace.
    const tag = key.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64);
    if (tag) return `${tag}+reply@${domain}`;
  }
  const fallback = fallbackReplyTo?.trim();
  return fallback || undefined;
}
