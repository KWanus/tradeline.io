import "server-only";

/**
 * Builds a plus-tagged Reply-To so an eventual reply auto-correlates to the
 * deal it came from. Requires REPLY_INBOUND_DOMAIN to be set; otherwise we fall
 * back to the operator's own reply address (replies still arrive — they just
 * don't auto-link). Returns undefined when there's nothing to set.
 */
export function replyAddressFor(
  bankKey?: string,
  fallback?: string
): string | undefined {
  const domain = process.env.REPLY_INBOUND_DOMAIN;
  if (domain && bankKey) {
    const tag = bankKey.replace(/[^a-zA-Z0-9_-]/g, "");
    return `inbound+${tag}@${domain}`;
  }
  return fallback || undefined;
}
