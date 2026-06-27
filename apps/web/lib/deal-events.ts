"use client";

/**
 * Append-only local log of pipeline stage changes — feeds cycle-time analytics
 * later. Client-side (localStorage); no-op on the server or when the stage
 * didn't actually change.
 */

const KEY = "tradeline.deal_events.v1";

export type DealEvent = {
  dealId: string;
  from: string;
  to: string;
  at: string; // ISO
};

export function recordStageChange(dealId: string, from: string, to: string): void {
  if (typeof window === "undefined") return;
  if (!dealId || from === to) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const events: DealEvent[] = raw ? JSON.parse(raw) : [];
    events.push({ dealId, from, to, at: new Date().toISOString() });
    // Keep the log bounded.
    window.localStorage.setItem(KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // localStorage unavailable — drop silently.
  }
}

export function readDealEvents(): DealEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DealEvent[]) : [];
  } catch {
    return [];
  }
}
