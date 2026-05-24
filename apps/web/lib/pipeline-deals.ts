"use client";

/**
 * Pipeline-deal mutator used to write a bid back from the calculator. Closes
 * the calc → pipeline loop: the operator deep-links into the calculator from
 * an inbox bid-recommendation card, picks a number, clicks Lock, and the
 * deal's `bidCentsPerDollar` updates in the pipeline store. The recommendation
 * card auto-resolves on the next render of the inbox (it filters out deals
 * that already have a bid).
 *
 * Pre-DB: writes directly to localStorage. Post-DB (P0): swap this for an
 * async DB call; call sites keep the same signature.
 */

const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

type Stage =
  | "sourced"
  | "reviewing"
  | "underwriting"
  | "bidding"
  | "won"
  | "lost"
  | "walked";

type Deal = {
  id: string;
  stage?: Stage;
  bidCentsPerDollar?: number;
  updatedAt?: string;
  [key: string]: unknown;
};

function readDeals(): Deal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIPELINE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Deal[]) : [];
  } catch {
    return [];
  }
}

function writeDeals(deals: Deal[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIPELINE_KEY, JSON.stringify(deals));
  } catch {}
}

export type SetBidResult =
  | { kind: "ok"; previousStage: Stage; newStage: Stage }
  | { kind: "not_found" }
  | { kind: "invalid_bid" };

/**
 * Set the bid on a pipeline deal by id. Also auto-advances the stage to
 * "bidding" when the deal was previously in sourced/reviewing/underwriting —
 * so the inbox bid-recommendation card disappears AND the pipeline reflects
 * the new state in one operation.
 *
 * `bidCentsPerDollar` is the price as cents-per-dollar of face (e.g. 4.77
 * for a 4.77¢ bid). Must be > 0 and ≤ 100.
 */
export function setBidOnDeal(
  dealId: string,
  bidCentsPerDollar: number
): SetBidResult {
  if (!Number.isFinite(bidCentsPerDollar) || bidCentsPerDollar <= 0) {
    return { kind: "invalid_bid" };
  }
  if (bidCentsPerDollar > 100) {
    return { kind: "invalid_bid" };
  }
  const deals = readDeals();
  const idx = deals.findIndex((d) => d.id === dealId);
  if (idx === -1) return { kind: "not_found" };
  const prev = deals[idx];
  const previousStage = (prev.stage || "sourced") as Stage;
  const advanceable: Stage[] = ["sourced", "reviewing", "underwriting"];
  const newStage: Stage = advanceable.includes(previousStage)
    ? "bidding"
    : previousStage;
  const next: Deal = {
    ...prev,
    bidCentsPerDollar: Math.round(bidCentsPerDollar * 100) / 100,
    stage: newStage,
    updatedAt: new Date().toISOString(),
  };
  const updated = [...deals];
  updated[idx] = next;
  writeDeals(updated);
  return { kind: "ok", previousStage, newStage };
}

/** Returns the deal's display name (`ticker · broker` if both present). */
export function dealDisplayName(dealId: string): string {
  const deals = readDeals();
  const d = deals.find((x) => x.id === dealId);
  if (!d) return "";
  const parts = [d.ticker, d.brokerName]
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  return parts.join(" · ");
}
