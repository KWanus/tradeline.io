/**
 * Inbound-reply store — the warm-inbound half of the outreach loop.
 *
 * A broker reply arrives one of two ways:
 *   1. Resend forwards the inbound email to /api/inbound-email, which
 *      classifies it and appends it to `replies.json` on the GitHub `data`
 *      branch (server-readable, same pattern as autopilot-state.json).
 *   2. The operator pastes a reply into the bank-page reply classifier,
 *      which mirrors it into localStorage so it surfaces immediately even
 *      before the inbound webhook is wired.
 *
 * This module is deliberately isomorphic (no `server-only` / `"use client"`)
 * so the Today server component AND the client notification bell can both
 * call it. `readInbox()` reads the data branch on the server and localStorage
 * in the browser; the two converge once the operator signs in to sync (P0).
 */

const REPLIES_PATH = "replies.json";
const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";
const GH_API = "https://api.github.com/repos/KWanus/tradeline.io/contents";
const LOCAL_KEY = "tradeline.replies.v1";
const MAX_ENTRIES = 500;

/** Coarse intent buckets — a superset of what the inbound webhook and the
 *  pasted-reply classifier both emit. Maps the richer classify-reply-llm
 *  taxonomy down to the four actions an operator actually takes. */
export type ReplyIntent =
  | "interested"
  | "wants_info"
  | "has_tape"
  | "passing"
  | "unsubscribe"
  | "unclear";

export type Reply = {
  id: string;
  /** Sender email address. */
  from: string;
  fromName?: string;
  subject?: string;
  /** Full reply body (trimmed to a sane length upstream). */
  body: string;
  intent: ReplyIntent;
  /** Correlated bank, when the plus-tagged Reply-To survived the round trip. */
  bankKey?: string;
  bankName?: string;
  /** Pipeline deal this reply belongs to, if known. */
  dealId?: string;
  /** ISO 8601 receipt timestamp. */
  receivedAt: string;
  acknowledged: boolean;
};

export const INTENT_LABEL: Record<ReplyIntent, string> = {
  interested: "Interested",
  wants_info: "Wants your materials",
  has_tape: "Has a tape",
  passing: "Passing for now",
  unsubscribe: "Unsubscribe",
  unclear: "Needs a read",
};

/** Urgency ordering so the inbox can float warm inbound above polite passes. */
export const INTENT_RANK: Record<ReplyIntent, number> = {
  has_tape: 0,
  interested: 1,
  wants_info: 2,
  unclear: 3,
  passing: 4,
  unsubscribe: 5,
};

function isReply(v: unknown): v is Reply {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Reply).id === "string" &&
    typeof (v as Reply).from === "string"
  );
}

function sortNewestFirst(rows: Reply[]): Reply[] {
  return [...rows].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

// ---------------------------------------------------------------------------
// Client-side localStorage mirror
// ---------------------------------------------------------------------------

function readLocal(): Reply[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter(isReply) as Reply[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: Reply[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = sortNewestFirst(rows).slice(0, MAX_ENTRIES);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed));
  } catch {}
}

/** Synchronous local read — for client components that can't await. */
export function readRepliesLocal(): Reply[] {
  return sortNewestFirst(readLocal());
}

/** Count of unacknowledged replies — drives the notification badge. */
export function unreadReplyCount(): number {
  return readLocal().filter((r) => !r.acknowledged).length;
}

export function addReplyLocal(reply: Omit<Reply, "id" | "acknowledged"> & { id?: string }): Reply {
  const full: Reply = {
    ...reply,
    id: reply.id || `reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    acknowledged: false,
  };
  const next = [full, ...readLocal().filter((r) => r.id !== full.id)];
  writeLocal(next);
  return full;
}

export function acknowledgeReplyLocal(id: string): void {
  const next = readLocal().map((r) =>
    r.id === id ? { ...r, acknowledged: true } : r
  );
  writeLocal(next);
}

// ---------------------------------------------------------------------------
// Server-side data-branch source
// ---------------------------------------------------------------------------

async function readBranch(): Promise<Reply[]> {
  try {
    const r = await fetch(`${RAW_BASE}/${REPLIES_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const parsed = (await r.json()) as unknown;
    return Array.isArray(parsed) ? (parsed.filter(isReply) as Reply[]) : [];
  } catch {
    return [];
  }
}

/**
 * Append a reply to the data branch. Requires GITHUB_PAT with contents:write.
 * Best-effort — returns `{ ok: false }` rather than throwing so the inbound
 * webhook can still 200 the provider (avoids retry storms) when GitHub is down.
 */
export async function appendReplyServer(
  reply: Omit<Reply, "id" | "acknowledged"> & { id?: string }
): Promise<{ ok: boolean; reason?: string; reply?: Reply }> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return { ok: false, reason: "GITHUB_PAT not set" };

  const full: Reply = {
    ...reply,
    id: reply.id || `reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    acknowledged: false,
  };

  const existing = await readBranch();
  const merged = sortNewestFirst([
    full,
    ...existing.filter((r) => r.id !== full.id),
  ]).slice(0, MAX_ENTRIES);

  let sha: string | undefined;
  try {
    const shaRes = await fetch(`${GH_API}/${REPLIES_PATH}?ref=data`, {
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
    JSON.stringify(merged, null, 2),
    "utf-8"
  ).toString("base64");

  try {
    const put = await fetch(`${GH_API}/${REPLIES_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore(replies): +1 from ${full.from}`,
        content: contentB64,
        branch: "data",
        sha,
      }),
    });
    if (!put.ok) {
      return { ok: false, reason: `GitHub ${put.status}` };
    }
    return { ok: true, reply: full };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Read the reply inbox. Isomorphic: data branch on the server, localStorage in
 * the browser. Newest first. Never throws — returns [] on any failure so the
 * Today page renders without inbound when the data branch is empty/offline.
 */
export async function readInbox(): Promise<Reply[]> {
  if (typeof window === "undefined") {
    return sortNewestFirst(await readBranch());
  }
  return readRepliesLocal();
}
