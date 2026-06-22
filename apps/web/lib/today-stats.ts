import "server-only";

import { readLog } from "@/lib/autopilot/state";
import { readInbox, type ReplyIntent } from "@/lib/replies";

/**
 * The 7-day throughput numbers behind the Today ribbon: how much outreach went
 * out, how much came back, and when the last reply landed. Reads the autopilot
 * log (sends) and the reply inbox (inbound) from the data branch. Resilient by
 * construction — both sources already swallow their own errors and return []
 * so this never throws (it's awaited without a guard on the Today page).
 */

export type TodayDay = {
  /** YYYY-MM-DD */
  date: string;
  /** Short weekday label, e.g. "Mon". */
  label: string;
  sent: number;
  replies: number;
};

export type TodayStats = {
  sentToday: number;
  sentLast7d: number;
  repliesLast7d: number;
  /** replies ÷ sends over the window, clamped 0..1. */
  replyRate: number;
  lastReplyAt?: string;
  lastReplyIntent?: ReplyIntent;
  lastSendAt?: string;
  /** Exactly 7 entries, oldest → newest. */
  days: TodayDay[];
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function emptyStats(): TodayStats {
  const days: TodayDay[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({ date: dayKey(d), label: WEEKDAY[d.getDay()], sent: 0, replies: 0 });
  }
  return {
    sentToday: 0,
    sentLast7d: 0,
    repliesLast7d: 0,
    replyRate: 0,
    days,
  };
}

export async function computeTodayStats(): Promise<TodayStats> {
  const stats = emptyStats();
  const byDay = new Map(stats.days.map((d) => [d.date, d]));
  const todayKey = dayKey(new Date());

  try {
    const [log, replies] = await Promise.all([readLog(), readInbox()]);

    let lastSendAt: string | undefined;
    for (const e of log) {
      if (e.status !== "sent" && e.status !== "dry-run") continue;
      if (!e.ts) continue;
      if (!lastSendAt || e.ts > lastSendAt) lastSendAt = e.ts;
      const k = dayKey(new Date(e.ts));
      const bucket = byDay.get(k);
      if (bucket) bucket.sent++;
      if (k === todayKey) stats.sentToday++;
    }
    stats.lastSendAt = lastSendAt;

    let lastReplyAt: string | undefined;
    let lastReplyIntent: ReplyIntent | undefined;
    for (const r of replies) {
      if (!r.receivedAt) continue;
      if (!lastReplyAt || r.receivedAt > lastReplyAt) {
        lastReplyAt = r.receivedAt;
        lastReplyIntent = r.intent;
      }
      const k = dayKey(new Date(r.receivedAt));
      const bucket = byDay.get(k);
      if (bucket) bucket.replies++;
    }
    stats.lastReplyAt = lastReplyAt;
    stats.lastReplyIntent = lastReplyIntent;

    stats.sentLast7d = stats.days.reduce((sum, d) => sum + d.sent, 0);
    stats.repliesLast7d = stats.days.reduce((sum, d) => sum + d.replies, 0);
    stats.replyRate =
      stats.sentLast7d > 0
        ? Math.min(1, stats.repliesLast7d / stats.sentLast7d)
        : 0;
  } catch {
    // Fall through to the zeroed stats — the ribbon renders an "all quiet" state.
  }

  return stats;
}
