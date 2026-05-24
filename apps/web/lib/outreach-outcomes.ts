"use client";

import type { Outcome } from "@/lib/autopilot/state";

/**
 * Client-side mirror of outcome tags applied via /api/outcome. The server log
 * is the source of truth (powers pattern-performance), but we keep a local
 * copy so the inbox UI can render the operator's last decision instantly,
 * without a round trip to GitHub.
 *
 * Keyed by Proposal.id (not bankKey) so re-rendering the same bank tomorrow
 * with a fresh send doesn't show yesterday's label.
 */

const KEY = "tradeline.outreach_outcomes.v1";
const MAX_ENTRIES = 500;

export type LocalOutcome = {
  outcome: Outcome;
  ts: string;
};

type Store = Record<string, LocalOutcome>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Store)
      : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  const entries = Object.entries(store);
  let toWrite: Store = store;
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => a[1].ts.localeCompare(b[1].ts));
    toWrite = Object.fromEntries(entries.slice(-MAX_ENTRIES));
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(toWrite));
  } catch {}
}

export function readOutcome(proposalId: string): LocalOutcome | null {
  if (!proposalId) return null;
  return readStore()[proposalId] || null;
}

export function setOutcome(proposalId: string, outcome: Outcome): void {
  if (!proposalId) return;
  const store = readStore();
  store[proposalId] = { outcome, ts: new Date().toISOString() };
  writeStore(store);
}
