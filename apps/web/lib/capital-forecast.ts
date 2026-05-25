// Portfolio-level expected-return forecast.
//
// For each owned holding, project gross + net recovery using the same
// asset-class defaults the Tape Copilot bid heuristic uses (recoveryPct,
// workoutYears, servicerFeePct). Compare to actual collections-to-date
// (when the operator records `cumulativeCollectedUsd`) to get a performance
// vs-expected ratio per holding and rolled up across the portfolio.
//
// Model is intentionally simple (linear recovery curve across workoutYears,
// CAGR approximation of IRR). Real NPL recovery is front-loaded S-shaped
// and IRR is a true discounted-cash-flow calc — V2 fidelity. V1 gives the
// operator a "are we ahead or behind on the portfolio?" answer.

import { ASSET_DEFAULTS, suggestDefaults, type AssetDefaults } from "./tape-analyzer";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type ForecastHolding = {
  id: string;
  ticker?: string;
  seller?: string;
  assetClass: string;
  faceValueUsd: number;
  purchasePriceUsd: number;
  purchaseDate: string; // ISO date YYYY-MM-DD
  cumulativeCollectedUsd?: number;
};

// ---------------------------------------------------------------------------
// Per-holding projection
// ---------------------------------------------------------------------------

export type HoldingForecast = {
  id: string;
  ticker: string;
  assetClass: string;
  // Inputs echoed for the UI
  faceValueUsd: number;
  purchasePriceUsd: number;
  purchaseDate: string;
  ageDays: number;
  // Asset-class defaults applied
  preset: AssetDefaults;
  // Projections (lifetime)
  expectedGrossRecovery: number; // face × recoveryPct
  expectedNetRecovery: number; // gross × (1 - servicerFeePct)
  // Projection-to-now (linear approximation)
  expectedCollectedToDate: number; // expectedNet × min(1, ageDays / workoutDays)
  actualCollectedToDate: number;
  performanceRatio: number; // actual / expectedToDate (1.0 = on track)
  // Forward looking
  daysRemainingInWorkout: number;
  // Multiple + rough CAGR (annualized return) on purchase price
  multipleOnCost: number; // expectedNet / purchasePrice
  cagrApprox: number; // (multiple)^(1/years) - 1, expressed as decimal
  // Status bucket
  status: "ahead" | "on_track" | "behind" | "no_collection_data";
};

const DAYS_PER_YEAR = 365.25;

function parseISODate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeAgeDays(purchaseDate: string, now: Date): number {
  const d = parseISODate(purchaseDate);
  if (!d) return 0;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

function statusFor(perf: number, hasData: boolean): HoldingForecast["status"] {
  if (!hasData) return "no_collection_data";
  if (perf >= 1.1) return "ahead";
  if (perf >= 0.9) return "on_track";
  return "behind";
}

export function forecastHolding(h: ForecastHolding, now: Date = new Date()): HoldingForecast {
  const preset = suggestDefaults(h.assetClass);
  const ageDays = computeAgeDays(h.purchaseDate, now);
  const workoutDays = preset.workoutYears * DAYS_PER_YEAR;
  const expectedGross = h.faceValueUsd * (preset.recoveryPct / 100);
  const expectedNet = expectedGross * (1 - preset.servicerFeePct / 100);
  const fractionToDate = workoutDays > 0 ? Math.min(1, ageDays / workoutDays) : 0;
  const expectedToDate = expectedNet * fractionToDate;
  const actual = Number(h.cumulativeCollectedUsd ?? 0);
  const hasCollectionData = h.cumulativeCollectedUsd !== undefined && h.cumulativeCollectedUsd !== null;
  const perf = expectedToDate > 0 ? actual / expectedToDate : 0;
  const daysRemaining = Math.max(0, workoutDays - ageDays);
  const multiple = h.purchasePriceUsd > 0 ? expectedNet / h.purchasePriceUsd : 0;
  const yearsForCAGR = Math.max(1 / 12, preset.workoutYears); // floor avoids divide-by-tiny
  const cagrApprox = multiple > 0 ? Math.pow(multiple, 1 / yearsForCAGR) - 1 : 0;

  return {
    id: h.id,
    ticker: h.ticker ?? "—",
    assetClass: h.assetClass,
    faceValueUsd: h.faceValueUsd,
    purchasePriceUsd: h.purchasePriceUsd,
    purchaseDate: h.purchaseDate,
    ageDays,
    preset,
    expectedGrossRecovery: expectedGross,
    expectedNetRecovery: expectedNet,
    expectedCollectedToDate: expectedToDate,
    actualCollectedToDate: actual,
    performanceRatio: perf,
    daysRemainingInWorkout: daysRemaining,
    multipleOnCost: multiple,
    cagrApprox,
    status: statusFor(perf, hasCollectionData),
  };
}

// ---------------------------------------------------------------------------
// Portfolio rollup
// ---------------------------------------------------------------------------

export type PortfolioForecast = {
  holdings: HoldingForecast[];
  // Rollups
  totalFaceUsd: number;
  totalPurchaseUsd: number;
  totalExpectedGrossUsd: number;
  totalExpectedNetUsd: number;
  totalCollectedUsd: number;
  totalExpectedToDateUsd: number;
  // Portfolio-level performance vs expected
  performanceRatio: number; // collected / expectedToDate (1.0 = on track)
  // Portfolio multiple + CAGR (weighted by purchase price)
  portfolioMultiple: number; // expectedNet / purchaseTotal
  portfolioCagrApprox: number; // weighted CAGR
  // Status breakdown
  countsByStatus: Record<HoldingForecast["status"], number>;
  // Headline recommendation
  headline: string;
};

function weightedAvg(values: Array<{ value: number; weight: number }>): number {
  const sumW = values.reduce((s, v) => s + v.weight, 0);
  if (sumW === 0) return 0;
  return values.reduce((s, v) => s + v.value * v.weight, 0) / sumW;
}

export function forecastPortfolio(
  holdings: ForecastHolding[],
  now: Date = new Date()
): PortfolioForecast {
  const perHolding = holdings.map((h) => forecastHolding(h, now));

  const totalFace = perHolding.reduce((s, h) => s + h.faceValueUsd, 0);
  const totalPurchase = perHolding.reduce((s, h) => s + h.purchasePriceUsd, 0);
  const totalExpectedGross = perHolding.reduce((s, h) => s + h.expectedGrossRecovery, 0);
  const totalExpectedNet = perHolding.reduce((s, h) => s + h.expectedNetRecovery, 0);
  const totalCollected = perHolding.reduce((s, h) => s + h.actualCollectedToDate, 0);
  const totalExpectedToDate = perHolding.reduce((s, h) => s + h.expectedCollectedToDate, 0);
  const perf = totalExpectedToDate > 0 ? totalCollected / totalExpectedToDate : 0;
  const portfolioMultiple = totalPurchase > 0 ? totalExpectedNet / totalPurchase : 0;
  const portfolioCagr = weightedAvg(
    perHolding.map((h) => ({ value: h.cagrApprox, weight: h.purchasePriceUsd }))
  );

  const countsByStatus: PortfolioForecast["countsByStatus"] = {
    ahead: 0,
    on_track: 0,
    behind: 0,
    no_collection_data: 0,
  };
  for (const h of perHolding) countsByStatus[h.status]++;

  let headline: string;
  if (perHolding.length === 0) {
    headline = "No portfolio holdings yet — purchase a tape and record it at /app/portfolio.";
  } else if (countsByStatus.no_collection_data === perHolding.length) {
    headline =
      "Portfolio recorded but no collections logged. Add cumulativeCollectedUsd to each holding to track performance vs. projection.";
  } else if (perf >= 1.1) {
    headline = `Portfolio is running ahead of projection: ${(perf * 100).toFixed(0)}% of expected-to-date.`;
  } else if (perf >= 0.9) {
    headline = `Portfolio is on track: ${(perf * 100).toFixed(0)}% of expected-to-date.`;
  } else {
    headline = `Portfolio is running behind projection at ${(perf * 100).toFixed(0)}% of expected-to-date. Review underperforming holdings.`;
  }

  return {
    holdings: perHolding,
    totalFaceUsd: totalFace,
    totalPurchaseUsd: totalPurchase,
    totalExpectedGrossUsd: totalExpectedGross,
    totalExpectedNetUsd: totalExpectedNet,
    totalCollectedUsd: totalCollected,
    totalExpectedToDateUsd: totalExpectedToDate,
    performanceRatio: perf,
    portfolioMultiple,
    portfolioCagrApprox: portfolioCagr,
    countsByStatus,
    headline,
  };
}

// Re-export the asset-class presets so the UI can show what assumption
// was applied per holding.
export { ASSET_DEFAULTS };
