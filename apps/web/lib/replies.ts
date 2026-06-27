import "server-only";

import type { ReplyClassification } from "@/lib/classify-reply-llm";

/**
 * Inbound reply inbox.
 *
 * Replies that brokers send back are captured (by the inbound-reply webhook /
 * the operator forwarding them) and stored as a JSON array on the public
 * `data` branch (`replies.json`). Each entry can carry the classifier's verdict
 * (`classification` + a pre-drafted `suggestedReply`) so Today can fold warm
 * inbound into the same approval queue as cold outreach.
 *
 * Best-effort read: returns `[]` when the file is missing or unreachable, so a
 * cold-start tenant (no replies yet) renders Today normally.
 */

const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";
const GH_API = "https://api.github.com/repos/KWanus/tradeline.io/contents";
const REPLIES_PATH = "replies.json";
/** Keep the inbox bounded — it's a JSON blob, not a DB. */
const MAX_REPLIES = 300;

/** One inbound reply from a broker / institution. */
export type InboundReply = {
  id: string;
  fromEmail: string;
  fromName?: string;
  /** Institution key, when the reply correlated back to a send. */
  bankKey?: string;
  bankName?: string;
  subject?: string;
  body: string;
  /** ISO timestamp the reply arrived. */
  receivedAt: string;
  /** Classifier verdict, when the reply has been run through /api/classify-reply. */
  classification?: ReplyClassification["classification"];
  summary?: string;
  /** Pre-drafted next email (subject + body) from the classifier. */
  suggestedSubject?: string;
  suggestedReply?: string;
  /** Operator handling state. Unset = still in the queue. */
  handledAt?: string;
};

/** Read the reply inbox, newest first. Never throws. */
export async function readInbox(): Promise<InboundReply[]> {
  try {
    const r = await fetch(`${RAW_BASE}/${REPLIES_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const parsed = (await r.json()) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as InboundReply[])
      .filter((x) => x && typeof x.body === "string" && typeof x.receivedAt === "string")
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  } catch {
    return [];
  }
}

/** Whole-file write to replies.json via the GitHub Contents API (PAT-gated). */
async function writeInbox(
  replies: InboundReply[]
): Promise<{ ok: boolean; reason?: string }> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return { ok: false, reason: "GITHUB_PAT not set" };

  const trimmed = [...replies]
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
    .slice(0, MAX_REPLIES);

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
    JSON.stringify(trimmed, null, 2),
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
        message: "chore(replies): update inbox",
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

/** Insert a reply (newest), skipping if its id already exists. */
export async function appendReply(
  reply: InboundReply
): Promise<{ ok: boolean; reason?: string; duplicate?: boolean }> {
  const inbox = await readInbox();
  if (inbox.some((r) => r.id === reply.id)) {
    return { ok: true, duplicate: true };
  }
  const res = await writeInbox([reply, ...inbox]);
  return { ok: res.ok, reason: res.reason };
}

/** Patch one reply by id (e.g. mark handled). */
export async function updateReply(
  id: string,
  patch: Partial<InboundReply>
): Promise<{ ok: boolean; reply?: InboundReply; reason?: string }> {
  const inbox = await readInbox();
  const idx = inbox.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, reason: "reply not found" };
  inbox[idx] = { ...inbox[idx], ...patch, id };
  const res = await writeInbox(inbox);
  return { ok: res.ok, reply: inbox[idx], reason: res.reason };
}

/** Convenience: mark a reply handled (removes it from the pending queue). */
export async function markReplyHandled(
  id: string
): Promise<{ ok: boolean; reply?: InboundReply; reason?: string }> {
  return updateReply(id, { handledAt: new Date().toISOString() });
}
