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

/**
 * Inverse of `replyAddressFor`: pull the bankKey back out of an inbound "To"
 * address. An inbound reply addressed to `WAL+reply@<domain>` correlates to
 * bankKey `WAL`. Accepts a raw address or a "Name <addr>" form, and tolerates
 * any `+reply` plus-tag regardless of the configured domain (so a domain
 * change doesn't orphan in-flight replies). Returns undefined when there's no
 * recoverable tag.
 */
export function bankKeyFromReplyAddress(
  toAddress?: string | string[]
): string | undefined {
  const candidates = Array.isArray(toAddress)
    ? toAddress
    : typeof toAddress === "string"
      ? [toAddress]
      : [];
  for (const raw of candidates) {
    if (!raw) continue;
    // Strip a "Display Name <addr>" wrapper.
    const angle = raw.match(/<([^>]+)>/);
    const addr = (angle ? angle[1] : raw).trim().toLowerCase();
    const local = addr.split("@")[0];
    if (!local) continue;
    // Match "<tag>+reply" — the tag is everything before the +reply suffix.
    const m = local.match(/^(.+)\+reply$/);
    if (m && m[1]) return m[1];
  }
  return undefined;
}
