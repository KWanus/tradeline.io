import "server-only";

/**
 * Server-side do-not-contact (DNC) check used as a hard pre-send guard.
 *
 * The DNC list lives as a JSON array on the public `data` branch
 * (`do-not-contact.json`), the same place the autopilot log + radar snapshot
 * live. Entries are keyed by email (always) and optionally by bankKey, so an
 * operator can suppress a whole institution as well as a single address.
 *
 * Best-effort by design: if the file is missing or GitHub is unreachable this
 * returns `undefined` (no hit) so a transient outage never blocks a legitimate
 * send. The send route documents this trade-off at the call site.
 */

const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";
const DNC_PATH = "do-not-contact.json";

export type DncEntry = {
  /** Lower-cased recipient email. */
  email: string;
  /** Optional institution key (ticker / fdic-<cert> / ncua-<cert>). */
  bankKey?: string;
  /** Why it was added — surfaced in the block message. */
  reason: string;
  /** ISO timestamp. */
  addedAt: string;
};

export type DncHit = { reason: string; addedAt: string };

async function readDncList(): Promise<DncEntry[]> {
  try {
    const r = await fetch(`${RAW_BASE}/${DNC_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const parsed = (await r.json()) as unknown;
    return Array.isArray(parsed) ? (parsed as DncEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Returns a hit (`{reason, addedAt}`) when the recipient — or its institution
 * — is on the DNC list, otherwise `undefined`.
 */
export async function dncHitServer(
  to: string,
  bankKey?: string
): Promise<DncHit | undefined> {
  const email = to.trim().toLowerCase();
  if (!email) return undefined;
  const key = bankKey?.trim();
  const list = await readDncList();
  const hit = list.find((e) => {
    const entryEmail = (e.email || "").trim().toLowerCase();
    if (entryEmail && entryEmail === email) return true;
    if (key && e.bankKey && e.bankKey.trim() === key) return true;
    return false;
  });
  if (!hit) return undefined;
  return {
    reason: hit.reason || "manually suppressed",
    addedAt: hit.addedAt || new Date().toISOString(),
  };
}
