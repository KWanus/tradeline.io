"use client";

/**
 * Per-deal audit trail. Pipeline stage transitions are appended here so the
 * per-deal detail view (/app/pipeline/<id>) can show a timeline of how a deal
 * moved. Stored in localStorage alongside the deals themselves — this is a
 * single-device operator tool, same as the pipeline board.
 *
 * `recordStageChange` is a no-op when prev === next, mirroring the call sites
 * in the pipeline board which only fire on real transitions.
 */

const EVENTS_KEY = "tradeline.deal_events.v1";

export type DealEvent = {
  dealId: string;
  type: "stage_change";
  from: string;
  to: string;
  at: string;
};

function readAll(): DealEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DealEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(events: DealEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    // Bound the log so a churny operator doesn't grow localStorage unbounded.
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-2000)));
  } catch {}
}

/** Append a stage-change event. No-op on a non-transition. */
export function recordStageChange(
  dealId: string,
  from: string,
  to: string
): void {
  if (!dealId || from === to) return;
  const events = readAll();
  events.push({
    dealId,
    type: "stage_change",
    from,
    to,
    at: new Date().toISOString(),
  });
  writeAll(events);
}

/** All events for one deal, oldest first. */
export function readDealEvents(dealId: string): DealEvent[] {
  return readAll()
    .filter((e) => e.dealId === dealId)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}
