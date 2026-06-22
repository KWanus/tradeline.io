/**
 * Plus-tag correlation for inbound replies.
 *
 * When REPLY_INBOUND_DOMAIN is configured (a domain whose MX is pointed at
 * Resend's inbound stream), every outreach send gets a Reply-To of the shape
 *
 *     inbound+<bankKey>@reply.yourdomain.com
 *
 * The broker hits reply; their mail client keeps the plus-tagged address; the
 * inbound webhook (/api/inbound-email) parses the tag back out and links the
 * reply to the originating bank/deal. No tag, no domain → we fall back to the
 * operator's own address so the reply still lands in their normal inbox; it
 * just won't auto-correlate.
 *
 * Plain module (no server-only): the env var is server-side, but importing
 * this on the client is harmless — `replyAddressFor` simply returns the
 * fallback because the env var is undefined in the browser bundle.
 */

const DEFAULT_LOCALPART = "inbound";

/** Plus-tag local parts must avoid characters that break naive parsers. We
 *  only ever embed a bankKey (tickers, "fdic-<cert>", "ncua-<cert>"), so the
 *  conservative whitelist below is always a no-op in practice — it's a guard
 *  against future callers passing something exotic. */
function safeTag(bankKey: string): string {
  return bankKey.trim().replace(/[^A-Za-z0-9._-]/g, "");
}

/**
 * Build the Reply-To address for an outreach send.
 * @param bankKey  Stable bank identifier to embed in the plus-tag.
 * @param fallback The operator's own address, used when correlation is off.
 */
export function replyAddressFor(
  bankKey?: string,
  fallback?: string | null
): string | null {
  const domain = process.env.REPLY_INBOUND_DOMAIN?.trim();
  const localpart =
    process.env.REPLY_INBOUND_LOCALPART?.trim() || DEFAULT_LOCALPART;
  const tag = bankKey ? safeTag(bankKey) : "";
  if (domain && tag) {
    return `${localpart}+${tag}@${domain}`;
  }
  return fallback?.trim() || null;
}

/**
 * Reverse of `replyAddressFor` — pull the bankKey back out of an inbound
 * recipient address. Used by the inbound webhook to correlate. Returns an
 * empty object when the address carries no recognizable tag.
 */
export function parseInboundAddress(addr: string): { bankKey?: string } {
  if (!addr) return {};
  const at = addr.indexOf("@");
  const local = at === -1 ? addr : addr.slice(0, at);
  const plus = local.indexOf("+");
  if (plus === -1) return {};
  const tag = local.slice(plus + 1).trim();
  return tag ? { bankKey: tag } : {};
}
