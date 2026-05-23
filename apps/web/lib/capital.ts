"use client";

/**
 * Capital deployment math, shared by the /app/capital tracker widget and the
 * /app/today inbox. All inputs live in browser localStorage:
 *   - total capital      : a single number the operator sets here
 *   - deployed capital   : sum of purchase prices across owned portfolio tapes
 *   - committed capital  : sum of live bids on pipeline deals in "bidding" stage
 *   - available capital  : total − deployed − committed
 */

export const CAPITAL_KEY = "tradeline.capital.config.v1";
const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";
const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

export type CapitalState = {
  /** Whether the operator has set a total — gates the inbox warning. */
  configured: boolean;
  total: number;
  deployed: number;
  committed: number;
  available: number;
};

type Holding = { purchasePriceUsd?: number };
type Deal = {
  faceValueUsd?: number;
  bidCentsPerDollar?: number;
  stage?: string;
};

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function readTotalCapital(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(CAPITAL_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const n = Number(parsed?.totalCapitalUsd);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeTotalCapital(usd: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CAPITAL_KEY,
      JSON.stringify({ totalCapitalUsd: usd })
    );
  } catch {}
}

export function readCapitalState(): CapitalState {
  const total = readTotalCapital();

  const deployed = readJson<Holding>(PORTFOLIO_KEY).reduce(
    (sum, h) => sum + (Number(h.purchasePriceUsd) || 0),
    0
  );

  // A live bid commits capital: face value × bid cents-per-dollar ÷ 100.
  const committed = readJson<Deal>(PIPELINE_KEY)
    .filter((d) => d.stage === "bidding")
    .reduce((sum, d) => {
      const bid =
        (Number(d.faceValueUsd) || 0) *
        ((Number(d.bidCentsPerDollar) || 0) / 100);
      return sum + bid;
    }, 0);

  return {
    configured: total > 0,
    total,
    deployed,
    committed,
    available: total - deployed - committed,
  };
}
