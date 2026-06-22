"use client";

/**
 * Append-only event log for pipeline deals. Today it captures stage
 * transitions; the log feeds the activity panel and (later) a per-deal
 * timeline. Kept separate from the deal records themselves so the board can
 * rewrite a deal without losing its history.
 */

const KEY = "tradeline.deal_events.v1";
const MAX_ENTRIES = 1000;

export type DealEvent = {
  id: string;
  dealId: string;
  type: "stage_change";
  from: string;
  to: string;
  ts: string;
};

function read(): DealEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DealEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: DealEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = events.length > MAX_ENTRIES ? events.slice(-MAX_ENTRIES) : events;
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
}

/** Record a stage transition. No-op when the stage didn't actually change. */
export function recordStageChange(
  dealId: string,
  from: string,
  to: string
): void {
  if (!dealId || from === to) return;
  const events = read();
  events.push({
    id: `${dealId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    dealId,
    type: "stage_change",
    from,
    to,
    ts: new Date().toISOString(),
  });
  write(events);
}

/** Read events, optionally filtered to one deal, newest first. */
export function readDealEvents(dealId?: string): DealEvent[] {
  const all = read().sort((a, b) => b.ts.localeCompare(a.ts));
  return dealId ? all.filter((e) => e.dealId === dealId) : all;
}
