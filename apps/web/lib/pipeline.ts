"use client";

export type DealStage =
  | "sourced"
  | "reviewing"
  | "underwriting"
  | "bidding"
  | "won"
  | "lost"
  | "walked";

export type Deal = {
  id: string;
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  askCentsPerDollar?: number;
  bidCentsPerDollar?: number;
  stage: DealStage;
  notes: string;
  createdAt: string;
  updatedAt: string;
  // When a "won" deal has been converted into a /app/portfolio holding,
  // this carries the holding id so we don't surface it twice in the
  // /app/portfolio WonDealsPanel conversion queue.
  convertedToHoldingId?: string;
  // Servicer recommendation captured at decode time (from
  // matchServicersForTape against the operator's portfolio history).
  // Auto-fills the servicer field when this deal is converted to a
  // holding so the recommendation doesn't get lost between bid and
  // placement.
  recommendedServicer?: string;
};

export const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function readDeals(): Deal[] {
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

export function writeDeals(deals: Deal[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIPELINE_KEY, JSON.stringify(deals));
  } catch {}
}

export function dealForTicker(ticker: string): Deal | undefined {
  return readDeals().find((d) => d.ticker === ticker);
}

// Advance a deal's stage when a correlated reply lands. Matches bankKey
// against deal.bankKey first (FDIC/NCUA), then ticker (SEC). Returns the
// updated deal, or undefined when no match.
//
// Stage advancement is conservative — we only push *forward*. A reply on
// a deal already at won/lost doesn't regress.
export function advanceDealForReply(
  bankKey: string,
  toStage: DealStage
): Deal | undefined {
  if (!bankKey) return undefined;
  const deals = readDeals();
  // Find by bankKey first, then ticker (case-insensitive)
  const key = bankKey.toLowerCase();
  const idx = deals.findIndex((d) => {
    const dKey = (d as Deal & { bankKey?: string }).bankKey;
    if (dKey && dKey.toLowerCase() === key) return true;
    if (d.ticker && d.ticker.toLowerCase() === key) return true;
    return false;
  });
  if (idx < 0) return undefined;
  const STAGE_RANK: Record<DealStage, number> = {
    sourced: 0,
    reviewing: 1,
    underwriting: 2,
    bidding: 3,
    won: 4,
    lost: 4,
    walked: 4,
  };
  const existing = deals[idx];
  if (STAGE_RANK[toStage] <= STAGE_RANK[existing.stage]) return existing;
  existing.stage = toStage;
  existing.updatedAt = new Date().toISOString();
  writeDeals(deals);
  return existing;
}

export function upsertDealForBank(args: {
  ticker: string;
  brokerName: string;
  assetClass: string;
  signalNote?: string;
}): Deal {
  const deals = readDeals();
  const now = new Date().toISOString();
  const existing = deals.find((d) => d.ticker === args.ticker);
  if (existing) {
    existing.brokerName = existing.brokerName || args.brokerName;
    existing.assetClass = existing.assetClass || args.assetClass;
    existing.updatedAt = now;
    if (args.signalNote && !existing.notes.includes(args.signalNote)) {
      existing.notes = existing.notes
        ? `${existing.notes}\n\n${args.signalNote}`
        : args.signalNote;
    }
    writeDeals(deals);
    return existing;
  }
  const created: Deal = {
    id: newId(),
    ticker: args.ticker,
    brokerName: args.brokerName,
    assetClass: args.assetClass,
    faceValueUsd: 0,
    stage: "sourced",
    notes: args.signalNote || "",
    createdAt: now,
    updatedAt: now,
  };
  deals.unshift(created);
  writeDeals(deals);
  return created;
}
