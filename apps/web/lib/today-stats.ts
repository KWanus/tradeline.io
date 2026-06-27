import "server-only";

import { readLog } from "@/lib/autopilot/state";
import { readInbox, type InboundReply } from "@/lib/replies";

/**
 * 7-day metric loop rendered in the Today ribbon + used to fire the
 * reply-celebration. Reads the autopilot send log and the reply inbox (both
 * cheap JSON blobs on the data branch) and rolls them into a small summary.
 *
 * Everything is best-effort: a missing log or inbox just yields zeros, so a
 * fresh tenant still renders Today.
 */

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type TodayStats = {
  /** Sends (real or dry-run) in the last 7 days. */
  sent7d: number;
  /** Replies received in the last 7 days. */
  replies7d: number;
  /** replies7d / sent7d, 0..1. 0 when no sends. */
  replyRate: number;
  /** Total replies still awaiting handling. */
  pendingReplies: number;
  /** ISO timestamp of the most recent reply, or null. */
  lastReplyAt: string | null;
  /** Classifier intent of the most recent reply, or null. */
  lastReplyIntent: string | null;
};

const EMPTY: TodayStats = {
  sent7d: 0,
  replies7d: 0,
  replyRate: 0,
  pendingReplies: 0,
  lastReplyAt: null,
  lastReplyIntent: null,
};

function withinWindow(iso: string, now: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && now - t <= WINDOW_MS && t <= now;
}

export async function computeTodayStats(): Promise<TodayStats> {
  const now = Date.now();
  let log: Awaited<ReturnType<typeof readLog>> = [];
  let replies: InboundReply[] = [];
  try {
    [log, replies] = await Promise.all([readLog(), readInbox()]);
  } catch {
    return { ...EMPTY };
  }

  const sent7d = log.filter(
    (e) => (e.status === "sent" || e.status === "dry-run") && withinWindow(e.ts, now)
  ).length;
  const replies7d = replies.filter((r) => withinWindow(r.receivedAt, now)).length;
  const pendingReplies = replies.filter((r) => !r.handledAt).length;

  const newest = replies[0] || null; // readInbox returns newest-first

  return {
    sent7d,
    replies7d,
    replyRate: sent7d > 0 ? Math.min(1, replies7d / sent7d) : 0,
    pendingReplies,
    lastReplyAt: newest?.receivedAt ?? null,
    lastReplyIntent: newest?.classification ?? null,
  };
}
