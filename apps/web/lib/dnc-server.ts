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
const GH_API = "https://api.github.com/repos/KWanus/tradeline.io/contents";
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

export async function readDncList(): Promise<DncEntry[]> {
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

/** Whole-file write to do-not-contact.json via the GitHub Contents API. */
async function writeDncList(
  list: DncEntry[]
): Promise<{ ok: boolean; reason?: string }> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return { ok: false, reason: "GITHUB_PAT not set" };

  let sha: string | undefined;
  try {
    const shaRes = await fetch(`${GH_API}/${DNC_PATH}?ref=data`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (shaRes.ok) {
      const meta = (await shaRes.json()) as { sha?: string };
      sha = meta.sha;
    }
  } catch {}

  const contentB64 = Buffer.from(
    JSON.stringify(list, null, 2),
    "utf-8"
  ).toString("base64");

  try {
    const put = await fetch(`${GH_API}/${DNC_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "chore(dnc): update do-not-contact list",
        content: contentB64,
        branch: "data",
        ...(sha ? { sha } : {}),
      }),
    });
    if (!put.ok) {
      return { ok: false, reason: `GitHub ${put.status}: ${(await put.text()).slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Add (or refresh) a DNC entry, keyed by email. */
export async function appendDnc(entry: {
  email: string;
  bankKey?: string;
  reason?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = entry.email.trim().toLowerCase();
  if (!email) return { ok: false, reason: "email required" };
  const list = await readDncList();
  const next: DncEntry = {
    email,
    bankKey: entry.bankKey?.trim() || undefined,
    reason: entry.reason?.trim() || "manually suppressed",
    addedAt: new Date().toISOString(),
  };
  const deduped = list.filter((e) => (e.email || "").trim().toLowerCase() !== email);
  const res = await writeDncList([next, ...deduped]);
  return { ok: res.ok, reason: res.reason };
}

/** Remove a DNC entry by email. */
export async function removeDnc(
  email: string
): Promise<{ ok: boolean; reason?: string }> {
  const target = email.trim().toLowerCase();
  const list = await readDncList();
  const next = list.filter((e) => (e.email || "").trim().toLowerCase() !== target);
  if (next.length === list.length) return { ok: true }; // nothing to remove
  const res = await writeDncList(next);
  return { ok: res.ok, reason: res.reason };
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
