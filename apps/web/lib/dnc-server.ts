import "server-only";

/**
 * Server-side do-not-contact guard.
 *
 * The DNC list lives on the GitHub `data` branch (`do-not-contact.json`) so
 * both the inbox UI and the send route read the same source. An entry is added
 * when a broker replies "unsubscribe", bounces hard, or the operator manually
 * blocks an address from /app/inbox/do-not-contact.
 *
 * `dncHitServer` is intentionally fail-open: if the data branch is missing or
 * GitHub is unreachable it returns `undefined` (no hit) rather than throwing.
 * Blocking every send on a transient outage would be worse than the rare
 * over-send — and the client carries its own DNC check as a second line.
 */

const DNC_PATH = "do-not-contact.json";
const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";

export type DncEntry = {
  /** Lower-cased email address. */
  email: string;
  reason: string;
  /** ISO 8601 timestamp. */
  addedAt: string;
  /** Optional bank this address was associated with at block time. */
  bankKey?: string;
};

function isEntry(v: unknown): v is DncEntry {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as DncEntry).email === "string" &&
    typeof (v as DncEntry).addedAt === "string"
  );
}

async function readList(): Promise<DncEntry[]> {
  try {
    const r = await fetch(`${RAW_BASE}/${DNC_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const parsed = (await r.json()) as unknown;
    return Array.isArray(parsed) ? (parsed.filter(isEntry) as DncEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Returns the matching DNC entry when `email` (or its associated `bankKey`)
 * is on the list, otherwise `undefined`. Matching is case-insensitive on the
 * email; bankKey is an exact match.
 */
export async function dncHitServer(
  email: string,
  bankKey?: string
): Promise<{ reason: string; addedAt: string } | undefined> {
  const target = email.trim().toLowerCase();
  if (!target) return undefined;
  const list = await readList();
  const hit = list.find(
    (e) =>
      e.email.trim().toLowerCase() === target ||
      (!!bankKey && e.bankKey === bankKey)
  );
  return hit ? { reason: hit.reason || "blocked", addedAt: hit.addedAt } : undefined;
}
