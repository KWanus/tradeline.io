"use client";

/**
 * Saved outreach contacts. Every time you send an outreach email from the
 * inbox, the recipient is remembered here — so the next card autocompletes
 * the address instead of making you type it again.
 */

export const CONTACTS_KEY = "tradeline.contacts.v1";

export type Contact = { email: string; label: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function readContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Contact[]) : [];
  } catch {
    return [];
  }
}

function writeContacts(contacts: Contact[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  } catch {}
}

/** Add a contact, deduped on lowercased email. Returns the updated list. */
export function addContact(email: string, label?: string): Contact[] {
  const e = email.trim().toLowerCase();
  const existing = readContacts();
  if (!EMAIL_RE.test(e)) return existing;
  if (existing.some((c) => c.email === e)) return existing;
  const next = [...existing, { email: e, label: label?.trim() || e }];
  writeContacts(next);
  return next;
}
