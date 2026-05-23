"use client";

/**
 * Per-bank outreach contact. Keyed by:
 *   - ticker (e.g. "WAL")            — SEC-tracked banks
 *   - "fdic-<cert>" (e.g. "fdic-628") — FDIC community banks
 *   - "ncua-<cert>" (e.g. "ncua-1")   — NCUA credit unions
 *
 * Once you send to a specific bank, the recipient is remembered so the next
 * outreach card for that same bank prefills with the email — turning the
 * 9-card daily queue into a true one-click flow once it's seeded.
 */

const KEY = "tradeline.bank_contacts.v1";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type BankContactMap = Record<string, string>;

function read(): BankContactMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as BankContactMap;
    }
    return {};
  } catch {
    return {};
  }
}

function write(map: BankContactMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function getBankContact(bankKey: string | undefined | null): string {
  if (!bankKey) return "";
  const map = read();
  return map[bankKey] || "";
}

export function setBankContact(bankKey: string, email: string): void {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return;
  const map = read();
  if (map[bankKey] === e) return;
  map[bankKey] = e;
  write(map);
}
