import "server-only";

import { readInbox, type ReplyIntent } from "@/lib/replies";

/**
 * The 7-day metric loop shown in the Today ribbon. Computed from the reply
 * inbox (the only outcome source that exists). With no replies yet, every
 * count is zero and `lastReply*` are null — the ribbon renders a neutral
 * "no activity yet" state rather than inventing numbers.
 */

export type TodayStats = {
  repliesThisWeek: number;
  interestedThisWeek: number;
  lastReplyAt: string | null;
  lastReplyIntent: ReplyIntent | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function computeTodayStats(): Promise<TodayStats> {
  const replies = await readInbox().catch(() => []);
  const since = Date.now() - WEEK_MS;

  const recent = replies.filter((r) => {
    const t = new Date(r.receivedAt).getTime();
    return Number.isFinite(t) && t >= since;
  });

  const sorted = [...replies].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
  const last = sorted[0];

  return {
    repliesThisWeek: recent.length,
    interestedThisWeek: recent.filter(
      (r) => r.intent === "interested" || r.intent === "pricing" || r.intent === "meeting"
    ).length,
    lastReplyAt: last?.receivedAt ?? null,
    lastReplyIntent: last?.intent ?? null,
  };
}
