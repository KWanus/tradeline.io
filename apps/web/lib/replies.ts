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
const REPLIES_PATH = "replies.json";

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
