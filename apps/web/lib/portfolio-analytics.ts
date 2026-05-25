// Portfolio analytics — rollups across the operator's holdings + their
// monthly remittance time-series. Builds on the existing
// `recoveryStatus()` + front-loaded model from lib/collections.ts so this
// module stays pure analytics; no model invention.
//
// Consumers: the new /app/portfolio Performance Dashboard. Pure functions
// (no localStorage / no fetches) — the dashboard component reads holdings
// + collections and passes them in.

import {
  expectedFraction,
  recoveryStatus,
  totalCollected,
  type HoldingCollections,
  type RecoveryStatus,
} from "./collections";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

// Light holding shape — caller projects the full Holding type down to this.
export type AnalyticsHolding = {
  id: string;
  ticker: string;
  seller: string;
  servicer: string;
  assetClass: string;
  faceValueUsd: number;
  purchasePriceUsd: number;
  vintageYear?: number;
  purchaseDate: string; // YYYY-MM-DD
};

// ---------------------------------------------------------------------------
// Per-holding enriched view
// ---------------------------------------------------------------------------

export type EnrichedHolding = {
  holding: AnalyticsHolding;
  collections: HoldingCollections;
  monthsHeld: number;
  totalCollectedUsd: number;
  status: RecoveryStatus;
  // Velocity: avg $ collected per month over the last 6 remittance months
  // (or all available if fewer). 0 when no remittances logged.
  velocityPerMonth: number;
  // Projection: expected total collected at end of workout
  lifetimeExpectedUsd: number;
  // Remaining = lifetimeExpectedUsd - totalCollectedUsd
  remainingExpectedUsd: number;
  // 90-day forward projection using front-loaded model from current month
  forecast90DayUsd: number;
};

const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

function monthsBetween(fromISO: string, to: Date): number {
  const from = new Date(fromISO);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_MONTH));
}

function recentVelocity(hc: HoldingCollections, windowMonths = 6): number {
  if (hc.remittances.length === 0) return 0;
  // Sort newest first by month string (YYYY-MM lexically sorts correctly)
  const sorted = [...hc.remittances].sort((a, b) => b.month.localeCompare(a.month));
  const window = sorted.slice(0, windowMonths);
  const total = window.reduce((s, r) => s + (Number(r.amountUsd) || 0), 0);
  return total / window.length;
}

function forecast90Days(enriched: Omit<EnrichedHolding, "forecast90DayUsd">): number {
  const { holding, collections, monthsHeld, lifetimeExpectedUsd, totalCollectedUsd } = enriched;
  // Two estimates, take the lower (conservative):
  //   1. Model-implied: expected at (monthsHeld + 3) minus expected now
  //   2. Velocity-implied: recent-velocity × 3 months
  const modelNow = lifetimeExpectedUsd * expectedFraction(monthsHeld, collections.workoutMonths);
  const modelIn3Mo = lifetimeExpectedUsd * expectedFraction(monthsHeld + 3, collections.workoutMonths);
  const modelImpliedNext90 = Math.max(0, modelIn3Mo - modelNow);
  const velocityImpliedNext90 = recentVelocity(collections) * 3;
  // Cap by what's left to collect
  const remaining = Math.max(0, lifetimeExpectedUsd - totalCollectedUsd);
  return Math.min(remaining, Math.min(modelImpliedNext90, velocityImpliedNext90));
}

export function enrichHolding(
  holding: AnalyticsHolding,
  collections: HoldingCollections,
  now: Date = new Date()
): EnrichedHolding {
  const monthsHeld = monthsBetween(holding.purchaseDate, now);
  const totalCollectedUsd = totalCollected(collections);
  const status = recoveryStatus(collections, holding.faceValueUsd, monthsHeld);
  const velocityPerMonth = recentVelocity(collections);
  const lifetimeExpectedUsd = status.lifetimeExpectedUsd;
  const remainingExpectedUsd = Math.max(0, lifetimeExpectedUsd - totalCollectedUsd);
  const interim = {
    holding,
    collections,
    monthsHeld,
    totalCollectedUsd,
    status,
    velocityPerMonth,
    lifetimeExpectedUsd,
    remainingExpectedUsd,
  };
  return {
    ...interim,
    forecast90DayUsd: forecast90Days(interim),
  };
}

// ---------------------------------------------------------------------------
// Group rollup (servicer / vintage / asset class)
// ---------------------------------------------------------------------------

export type GroupRollup = {
  key: string;
  holdingCount: number;
  totalFaceUsd: number;
  totalPurchaseUsd: number;
  totalCollectedUsd: number;
  totalExpectedNowUsd: number;
  totalLifetimeExpectedUsd: number;
  // Weighted avg performance vs expected-to-date
  performanceRatio: number;
  // Realized cents per purchase dollar (collected / purchase)
  realizedCentsPerDollar: number;
  // Forecasted next 90 days from this group
  forecast90DayUsd: number;
};

function groupBy(
  enriched: EnrichedHolding[],
  keyFn: (h: AnalyticsHolding) => string
): GroupRollup[] {
  const map = new Map<string, EnrichedHolding[]>();
  for (const e of enriched) {
    const k = keyFn(e.holding) || "—";
    const list = map.get(k) ?? [];
    list.push(e);
    map.set(k, list);
  }
  const rollups: GroupRollup[] = [];
  for (const [key, list] of map) {
    const totalFace = list.reduce((s, e) => s + e.holding.faceValueUsd, 0);
    const totalPurchase = list.reduce((s, e) => s + e.holding.purchasePriceUsd, 0);
    const totalCollected = list.reduce((s, e) => s + e.totalCollectedUsd, 0);
    const totalExpectedNow = list.reduce((s, e) => s + e.status.expectedNowUsd, 0);
    const totalLifetimeExpected = list.reduce((s, e) => s + e.lifetimeExpectedUsd, 0);
    const performanceRatio = totalExpectedNow > 0 ? totalCollected / totalExpectedNow : 0;
    const realizedCentsPerDollar =
      totalPurchase > 0 ? (totalCollected / totalPurchase) * 100 : 0;
    const forecast90 = list.reduce((s, e) => s + e.forecast90DayUsd, 0);
    rollups.push({
      key,
      holdingCount: list.length,
      totalFaceUsd: totalFace,
      totalPurchaseUsd: totalPurchase,
      totalCollectedUsd: totalCollected,
      totalExpectedNowUsd: totalExpectedNow,
      totalLifetimeExpectedUsd: totalLifetimeExpected,
      performanceRatio,
      realizedCentsPerDollar,
      forecast90DayUsd: forecast90,
    });
  }
  return rollups;
}

// ---------------------------------------------------------------------------
// Portfolio-wide report
// ---------------------------------------------------------------------------

export type PortfolioPerformanceReport = {
  enriched: EnrichedHolding[];
  // Headline
  totalFaceUsd: number;
  totalPurchaseUsd: number;
  totalCollectedUsd: number;
  totalLifetimeExpectedUsd: number;
  totalExpectedNowUsd: number;
  portfolioPerformanceRatio: number; // collected / expectedNow
  realizedCentsPerDollar: number; // collected / purchase (on cost)
  forecast90DayUsd: number;
  velocityLastMonthUsd: number; // sum of last-month remittances
  // Status counts
  countsByStatus: Record<RecoveryStatus["label"], number>;
  // Groupings
  byServicer: GroupRollup[]; // sorted desc by realizedCentsPerDollar
  byVintage: GroupRollup[]; // sorted asc by vintage year
  byAssetClass: GroupRollup[]; // sorted desc by realizedCentsPerDollar
  // Highlights
  topPerformer: EnrichedHolding | null;
  worstUnderperformer: EnrichedHolding | null;
  // Headline recommendation
  headline: string;
};

function lastMonthStr(now: Date): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildPerformanceReport(
  holdings: AnalyticsHolding[],
  allCollections: HoldingCollections[],
  now: Date = new Date()
): PortfolioPerformanceReport {
  const collectionsByHolding = new Map<string, HoldingCollections>();
  for (const c of allCollections) collectionsByHolding.set(c.holdingId, c);

  const enriched = holdings.map((h) =>
    enrichHolding(
      h,
      collectionsByHolding.get(h.id) ?? {
        holdingId: h.id,
        expectedRecoveryPct: 15,
        workoutMonths: 36,
        remittances: [],
      },
      now
    )
  );

  const totalFace = enriched.reduce((s, e) => s + e.holding.faceValueUsd, 0);
  const totalPurchase = enriched.reduce((s, e) => s + e.holding.purchasePriceUsd, 0);
  const totalCollectedAll = enriched.reduce((s, e) => s + e.totalCollectedUsd, 0);
  const totalLifetime = enriched.reduce((s, e) => s + e.lifetimeExpectedUsd, 0);
  const totalExpectedNow = enriched.reduce((s, e) => s + e.status.expectedNowUsd, 0);
  const perf = totalExpectedNow > 0 ? totalCollectedAll / totalExpectedNow : 0;
  const realizedCpd =
    totalPurchase > 0 ? (totalCollectedAll / totalPurchase) * 100 : 0;
  const forecast90 = enriched.reduce((s, e) => s + e.forecast90DayUsd, 0);

  // Last-month velocity = sum of all remittances in last calendar month
  const lastMonth = lastMonthStr(now);
  const velocityLastMonth = enriched.reduce((s, e) => {
    const r = e.collections.remittances.find((x) => x.month === lastMonth);
    return s + (r?.amountUsd ?? 0);
  }, 0);

  // Status counts
  const countsByStatus: PortfolioPerformanceReport["countsByStatus"] = {
    ahead: 0,
    "on-track": 0,
    behind: 0,
  };
  for (const e of enriched) countsByStatus[e.status.label]++;

  // Groupings
  const byServicer = groupBy(enriched, (h) => h.servicer || "(no servicer)")
    .sort((a, b) => b.realizedCentsPerDollar - a.realizedCentsPerDollar);
  const byVintage = groupBy(enriched, (h) =>
    h.vintageYear ? String(h.vintageYear) : "(no vintage)"
  ).sort((a, b) => a.key.localeCompare(b.key));
  const byAssetClass = groupBy(enriched, (h) => h.assetClass || "(no class)")
    .sort((a, b) => b.realizedCentsPerDollar - a.realizedCentsPerDollar);

  // Highlights — best/worst by performance ratio (among those with collection data)
  const withData = enriched.filter((e) => e.totalCollectedUsd > 0 && e.status.expectedNowUsd > 0);
  const topPerformer = withData.length > 0
    ? [...withData].sort((a, b) => b.status.deltaPct - a.status.deltaPct)[0]
    : null;
  const worstUnderperformer = withData.length > 0
    ? [...withData].sort((a, b) => a.status.deltaPct - b.status.deltaPct)[0]
    : null;

  // Headline
  let headline: string;
  if (enriched.length === 0) {
    headline = "No holdings yet — purchase a tape and record it below.";
  } else if (totalCollectedAll === 0) {
    headline = "No remittances logged. Use the collections tracker below to start scoring tapes against the model.";
  } else if (perf >= 1.1) {
    headline = `Book is ahead of model: ${(perf * 100).toFixed(0)}% of expected-to-date. Realized ${realizedCpd.toFixed(1)}¢/$ on cost.`;
  } else if (perf >= 0.9) {
    headline = `Book is on track: ${(perf * 100).toFixed(0)}% of expected-to-date. Next 90 days forecasted at ${formatUsdShort(forecast90)}.`;
  } else {
    headline = `Book is behind model at ${(perf * 100).toFixed(0)}% of expected-to-date. ${countsByStatus.behind} of ${enriched.length} holdings flagged.`;
  }

  return {
    enriched,
    totalFaceUsd: totalFace,
    totalPurchaseUsd: totalPurchase,
    totalCollectedUsd: totalCollectedAll,
    totalLifetimeExpectedUsd: totalLifetime,
    totalExpectedNowUsd: totalExpectedNow,
    portfolioPerformanceRatio: perf,
    realizedCentsPerDollar: realizedCpd,
    forecast90DayUsd: forecast90,
    velocityLastMonthUsd: velocityLastMonth,
    countsByStatus,
    byServicer,
    byVintage,
    byAssetClass,
    topPerformer,
    worstUnderperformer,
    headline,
  };
}

function formatUsdShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}
