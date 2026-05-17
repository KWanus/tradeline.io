import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-click unsubscribe tokens for the weekly digest. Keyed by HMAC-SHA256
 * of the lowercased email + a server-side secret. Same email always produces
 * the same token, so links in old emails keep working forever.
 *
 * We reuse CRON_SECRET as the signing secret because it's already required
 * for the weekly auto-send. UNSUBSCRIBE_SECRET overrides if you want a
 * dedicated key (recommended for production).
 */

function secret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || null;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function makeUnsubToken(email: string): string | null {
  const k = secret();
  if (!k) return null;
  const normalized = email.trim().toLowerCase();
  const mac = createHmac("sha256", k).update(normalized).digest();
  return b64url(mac).slice(0, 32);
}

export function verifyUnsubToken(email: string, token: string): boolean {
  const expected = makeUnsubToken(email);
  if (!expected) return false;
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(b64urlDecode(expected), b64urlDecode(token));
  } catch {
    return false;
  }
}

export function unsubscribeUrl(email: string, siteUrl: string): string | null {
  const token = makeUnsubToken(email);
  if (!token) return null;
  const site = siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ email: email.trim().toLowerCase(), token });
  return `${site}/unsubscribe?${params.toString()}`;
}
