// Comp-set pricing — the V3 moat ingredient.
//
// Replaces the static asset-class defaults ("CC fresh = 14% recovery over
// 5y") with the operator's OWN realized history: "on the last 8 tapes like
// this, you bid 4.6¢/$ median, won 5 of 8, and collected 7.9¢/$ over 18mo
// for a 1.72× multiple and ~38% CAGR."
//
// Inputs:
//   - new tape characteristics (assetClass, faceValueUsd, optional vintage,
//     optional dominantState)
//   - operator's holdings (closed/owned tapes, with optional realized data)
//   - operator's closed deals (won/lost/walked from /app/pipeline)
//
// Output: CompSetReport with similarity-matched comps, percentile stats,
// recommended bid range, and confidence level. When comp count is too low
// (cold-start), recommends falling back to the industry asset-class defaults
// — the caller decides whether to surface the comp panel or the preset.
//
// Pure / no localStorage / no fetches. Caller assembles inputs.

import { ASSET_DEFAULTS, suggestDefaults, type AssetDefaults } from "./tape-analyzer";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type CompSetTape = {
  assetClass: string;
  faceValueUsd: number;
  vintageYear?: number;
  dominantState?: string;
};

export type CompSetHolding = {
  id: string;
  assetClass: string;
  faceValueUsd: number;
  purchasePriceUsd: number;
  vintageYear?: number;
  purchaseDate: string; // YYYY-MM-DD
  cumulativeCollectedUsd?: number;
};

export type CompSetDeal = {
  id: string;
  assetClass: string;
  faceValueUsd: number;
  bidCentsPerDollar?: number;
  askCentsPerDollar?: number;
  stage: "sourced" | "reviewing" | "underwriting" | "bidding" | "won" | "lost" | "walked";
};

// ---------------------------------------------------------------------------
// Per-comp scoring + match result
// ---------------------------------------------------------------------------

export type CompMatch = {
  id: string;
  source: "holding" | "deal";
  assetClass: string;
  faceValueUsd: number;
  vintageYear?: number;
  // For holdings: paid in ¢/$ = purchasePrice/face. For deals: bid in ¢/$.
  bidOrPriceCentsPerDollar: number | null;
  // For holdings only: actual realized over time
  realizedMultiple: number | null; // collected / purchase
  realizedCagr: number | null;
  ageYears: number | null;
  outcome: "won" | "lost" | "walked" | "owned" | "active";
  similarityScore: number; // 0..100
};

const ASSET_CLASS_REQUIRED_SCORE = 50;

function normalizeAssetClass(s: string): string {
  if (!s) return "";
  const d = s.toLowerCase();
  if (/credit\s*card|\bcc\b|revolving|charge\s*card|store\s*card|retail\s*card/.test(d))
    return "credit_card";
  if (/auto|vehicle|car\s*loan/.test(d)) return "auto";
  if (/medical|hospital|healthcare/.test(d)) return "medical";
  if (/mortgage|home\s*equity|heloc|second\s*lien|junior\s*lien/.test(d)) return "mortgage";
  if (/student|education/.test(d)) return "student";
  if (/commercial|business|sba/.test(d)) return "commercial";
  if (/telecom|utility|wireless|cable/.test(d)) return "telecom";
  if (/tax\s*lien/.test(d)) return "tax_lien";
  return d.replace(/\s+/g, "_");
}

function computeAgeYears(purchaseDate: string, now: Date): number | null {
  const d = new Date(purchaseDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function scoreHolding(tape: CompSetTape, h: CompSetHolding): number {
  if (normalizeAssetClass(tape.assetClass) !== normalizeAssetClass(h.assetClass)) return 0;
  let score = ASSET_CLASS_REQUIRED_SCORE;
  if (tape.vintageYear && h.vintageYear) {
    const diff = Math.abs(tape.vintageYear - h.vintageYear);
    if (diff <= 1) score += 20;
    else if (diff <= 3) score += 10;
  }
  if (tape.faceValueUsd > 0 && h.faceValueUsd > 0) {
    const ratio = h.faceValueUsd / tape.faceValueUsd;
    if (ratio >= 0.8 && ratio <= 1.25) score += 25;
    else if (ratio >= 0.5 && ratio <= 2.0) score += 15;
  }
  return score;
}

function scoreDeal(tape: CompSetTape, d: CompSetDeal): number {
  if (normalizeAssetClass(tape.assetClass) !== normalizeAssetClass(d.assetClass)) return 0;
  let score = ASSET_CLASS_REQUIRED_SCORE;
  if (tape.faceValueUsd > 0 && d.faceValueUsd > 0) {
    const ratio = d.faceValueUsd / tape.faceValueUsd;
    if (ratio >= 0.8 && ratio <= 1.25) score += 25;
    else if (ratio >= 0.5 && ratio <= 2.0) score += 15;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Aggregate stats (percentile-based — robust against outliers)
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type CompSetConfidence = "cold_start" | "low" | "medium" | "high";

export type CompSetReport = {
  // Input echo (for UI)
  tape: CompSetTape;
  // Matched comps sorted by similarity desc
  matches: CompMatch[];
  totalMatches: number;
  // Confidence based on N
  confidence: CompSetConfidence;
  // Bid stats from the comp set (¢/$)
  bidStats: {
    median: number;
    p25: number;
    p75: number;
    min: number;
    max: number;
  } | null;
  // Win rate across won/lost/walked (deals only)
  winRate: number | null;
  winRateN: number; // total decisive deals (won + lost + walked)
  // Realized stats from owned holdings
  realizedStats: {
    medianMultiple: number;
    medianCagr: number;
    holdingsWithData: number;
  } | null;
  // Recommendation
  recommendedBidCentsPerDollar: number | null; // null when cold-start
  recommendedBidRange: { low: number; high: number } | null;
  // What to fall back to if cold-start
  fallbackPreset: AssetDefaults;
  // Headline
  headline: string;
};

const MIN_COMPS_FOR_RECOMMENDATION = 3;
const MIN_COMPS_FOR_MEDIUM_CONF = 5;
const MIN_COMPS_FOR_HIGH_CONF = 10;

function confidenceFor(n: number): CompSetConfidence {
  if (n >= MIN_COMPS_FOR_HIGH_CONF) return "high";
  if (n >= MIN_COMPS_FOR_MEDIUM_CONF) return "medium";
  if (n >= MIN_COMPS_FOR_RECOMMENDATION) return "low";
  return "cold_start";
}

export function computeCompSet(
  tape: CompSetTape,
  holdings: CompSetHolding[],
  deals: CompSetDeal[],
  now: Date = new Date()
): CompSetReport {
  const fallbackPreset = suggestDefaults(tape.assetClass);
  const matches: CompMatch[] = [];

  // Score holdings (always count toward comp set — paid + realized data)
  for (const h of holdings) {
    const score = scoreHolding(tape, h);
    if (score < ASSET_CLASS_REQUIRED_SCORE) continue;
    const ageYears = computeAgeYears(h.purchaseDate, now);
    const bidEquivalent =
      h.faceValueUsd > 0 ? (h.purchasePriceUsd / h.faceValueUsd) * 100 : null;
    const realizedMultiple =
      h.cumulativeCollectedUsd !== undefined && h.purchasePriceUsd > 0
        ? h.cumulativeCollectedUsd / h.purchasePriceUsd
        : null;
    const realizedCagr =
      realizedMultiple !== null && realizedMultiple > 0 && ageYears !== null && ageYears > 0
        ? Math.pow(realizedMultiple, 1 / Math.max(0.25, ageYears)) - 1
        : null;
    matches.push({
      id: h.id,
      source: "holding",
      assetClass: h.assetClass,
      faceValueUsd: h.faceValueUsd,
      vintageYear: h.vintageYear,
      bidOrPriceCentsPerDollar: bidEquivalent,
      realizedMultiple,
      realizedCagr,
      ageYears,
      outcome: "owned",
      similarityScore: score,
    });
  }

  // Score decisive deals (won/lost/walked) — these inform win rate
  let winRateN = 0;
  let wonCount = 0;
  for (const d of deals) {
    const score = scoreDeal(tape, d);
    if (score < ASSET_CLASS_REQUIRED_SCORE) continue;
    if (d.stage === "won" || d.stage === "lost" || d.stage === "walked") {
      winRateN++;
      if (d.stage === "won") wonCount++;
      // Skip already-counted won deals if a matching holding exists for the
      // same id — but we don't have that linkage, so accept the noise for V1.
      // Add lost/walked as "what you bid but didn't win" comps.
      if (d.stage === "lost" || d.stage === "walked") {
        matches.push({
          id: d.id,
          source: "deal",
          assetClass: d.assetClass,
          faceValueUsd: d.faceValueUsd,
          bidOrPriceCentsPerDollar:
            d.bidCentsPerDollar ?? d.askCentsPerDollar ?? null,
          realizedMultiple: null,
          realizedCagr: null,
          ageYears: null,
          outcome: d.stage,
          similarityScore: score,
        });
      }
    }
  }

  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  const totalMatches = matches.length;
  const confidence = confidenceFor(totalMatches);

  // Bid stats from matches that have bid/price info
  const bidValues = matches
    .map((m) => m.bidOrPriceCentsPerDollar)
    .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const bidStats =
    bidValues.length > 0
      ? {
          median: percentile(bidValues, 0.5),
          p25: percentile(bidValues, 0.25),
          p75: percentile(bidValues, 0.75),
          min: bidValues[0],
          max: bidValues[bidValues.length - 1],
        }
      : null;

  // Realized stats from holdings that have collection data
  const holdingsWithRealized = matches.filter(
    (m) => m.source === "holding" && m.realizedMultiple !== null
  );
  const realizedStats =
    holdingsWithRealized.length > 0
      ? {
          medianMultiple: median(holdingsWithRealized.map((m) => m.realizedMultiple!)),
          medianCagr: median(
            holdingsWithRealized
              .filter((m) => m.realizedCagr !== null)
              .map((m) => m.realizedCagr!)
          ),
          holdingsWithData: holdingsWithRealized.length,
        }
      : null;

  const winRate = winRateN > 0 ? wonCount / winRateN : null;

  // Recommendation: when enough comps + bid stats, use 25th-75th percentile
  // band. Otherwise null and caller surfaces fallback preset.
  let recommendedBidCentsPerDollar: number | null = null;
  let recommendedBidRange: { low: number; high: number } | null = null;
  if (confidence !== "cold_start" && bidStats) {
    recommendedBidCentsPerDollar = bidStats.median;
    recommendedBidRange = { low: bidStats.p25, high: bidStats.p75 };
  }

  // Headline
  let headline: string;
  if (confidence === "cold_start") {
    headline = `Cold start: only ${totalMatches} similar comp${totalMatches === 1 ? "" : "s"} in your history. Use industry default (${fallbackPreset.label}: ${fallbackPreset.recoveryPct}% recovery, ${fallbackPreset.irrPct}% IRR target) until you build comp depth.`;
  } else if (bidStats && realizedStats && winRate !== null) {
    headline = `Your comp set: ${totalMatches} similar tapes. You historically bid ${bidStats.median.toFixed(2)}¢/$ median, won ${(winRate * 100).toFixed(0)}% (${wonCount}/${winRateN}), and realized ${realizedStats.medianMultiple.toFixed(2)}× over time (~${(realizedStats.medianCagr * 100).toFixed(0)}% CAGR).`;
  } else if (bidStats) {
    headline = `Your comp set: ${totalMatches} similar tapes. Median bid ${bidStats.median.toFixed(2)}¢/$ (range ${bidStats.p25.toFixed(2)}–${bidStats.p75.toFixed(2)}). Insufficient realized data — log cumulative collections to build the recovery picture.`;
  } else {
    headline = `${totalMatches} similar comps, but no bid prices recorded. Backfill bidCentsPerDollar in /app/pipeline to enable comp-set pricing.`;
  }

  return {
    tape,
    matches,
    totalMatches,
    confidence,
    bidStats,
    winRate,
    winRateN,
    realizedStats,
    recommendedBidCentsPerDollar,
    recommendedBidRange,
    fallbackPreset,
    headline,
  };
}

export { ASSET_DEFAULTS };
