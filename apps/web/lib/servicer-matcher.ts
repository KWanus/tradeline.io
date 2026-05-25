// Servicer matcher — at the moment of bid decision, recommend which
// servicer in the operator's roster will historically perform best on
// THIS tape's profile.
//
// "Servicer X net-collects 8.4¢/$ on bankcard, 14-18mo vintage, $3-5k
//  avg balance · Servicer Y collects 6.1¢/$ on the same profile · in-
//  house collects 9.3¢/$ at 2.3× cost. Recommended split: 60% in-house,
//  40% Vendor X."
//
// V1 ranks ALL servicers the operator has used by predicted recovery on
// the new tape, using the median realized cents-per-purchase-dollar from
// the operator's matching historical holdings. Confidence tiers based on
// sample size. Cold-start (operator hasn't placed similar paper with any
// servicer yet) surfaces industry-benchmark fallbacks per asset class.
//
// Pure — no localStorage / no fetches. Caller assembles inputs.

import type { HoldingCollections } from "./collections";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type MatcherHolding = {
  id: string;
  servicer: string;
  assetClass: string;
  faceValueUsd: number;
  purchasePriceUsd: number;
  vintageYear?: number;
  purchaseDate: string; // YYYY-MM-DD
};

export type MatcherTape = {
  assetClass: string;
  faceValueUsd: number;
  vintageYear?: number;
};

// ---------------------------------------------------------------------------
// Per-servicer match
// ---------------------------------------------------------------------------

export type ServicerConfidence = "cold_start" | "low" | "medium" | "high";

export type ServicerMatch = {
  servicer: string;
  // How many of the operator's historical holdings matched this tape's
  // profile AND were placed with this servicer
  matchedHoldings: number;
  // Total face value of those holdings (context)
  matchedHoldingFaceUsd: number;
  totalPaidUsd: number;
  totalCollectedUsd: number;
  // Median realized cents-per-purchase-dollar across matching holdings
  // (where realized = total collected / purchase price × 100)
  medianRealizedCentsPerDollar: number;
  // Predicted recovery on the NEW tape (face × median realized rate × cost basis adjustment)
  predictedRecoveryUsdGross: number;
  // Confidence based on N
  confidence: ServicerConfidence;
  // Rank: 1 = best predicted recovery
  rank: number;
  // Surfaced notes (e.g., "skewed by 1 outlier holding")
  notes: string[];
};

// ---------------------------------------------------------------------------
// Industry-benchmark fallback when operator has no comparable history
// ---------------------------------------------------------------------------

type IndustryBenchmark = {
  assetClass: string; // canonical bucket key
  medianRecoveryCentsPerFaceDollar: number; // public-source observed
  note: string;
};

// Curated from CFPB Encore consent order observations + RMAI asset-class
// papers + public 10-Ks (PRA Group, Encore). These are intentionally
// conservative — operator's own history WILL be better signal.
const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  { assetClass: "credit_card", medianRecoveryCentsPerFaceDollar: 7, note: "PRA/Encore 10-K vintages 2-3yr post-CO" },
  { assetClass: "auto", medianRecoveryCentsPerFaceDollar: 22, note: "Subprime auto deficiency post-repo" },
  { assetClass: "medical", medianRecoveryCentsPerFaceDollar: 5, note: "Open-account medical, post-FCRA-2022 deletion" },
  { assetClass: "mortgage", medianRecoveryCentsPerFaceDollar: 55, note: "Junior mortgage seasoned 4yr+" },
  { assetClass: "student", medianRecoveryCentsPerFaceDollar: 10, note: "Private student loan, post-default" },
  { assetClass: "commercial", medianRecoveryCentsPerFaceDollar: 18, note: "Small commercial / SBA deficiency" },
  { assetClass: "telecom", medianRecoveryCentsPerFaceDollar: 4, note: "Telecom open-account stripes" },
  { assetClass: "tax_lien", medianRecoveryCentsPerFaceDollar: 80, note: "Senior tax lien, secured by property" },
];

function normalizeAssetClass(s: string | null | undefined): string {
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

function industryBenchmarkFor(assetClass: string): IndustryBenchmark | null {
  const norm = normalizeAssetClass(assetClass);
  return INDUSTRY_BENCHMARKS.find((b) => b.assetClass === norm) ?? null;
}

// ---------------------------------------------------------------------------
// Confidence + statistics
// ---------------------------------------------------------------------------

const MIN_HOLDINGS_FOR_RECOMMENDATION = 1;
const MIN_HOLDINGS_FOR_MEDIUM = 3;
const MIN_HOLDINGS_FOR_HIGH = 6;

function confidenceFor(n: number): ServicerConfidence {
  if (n >= MIN_HOLDINGS_FOR_HIGH) return "high";
  if (n >= MIN_HOLDINGS_FOR_MEDIUM) return "medium";
  if (n >= MIN_HOLDINGS_FOR_RECOMMENDATION) return "low";
  return "cold_start";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type ServicerMatchReport = {
  tape: MatcherTape;
  matches: ServicerMatch[];
  // The operator has placed with this many distinct servicers; matches.length
  // is the subset that have comparable history for THIS tape's profile.
  totalServicersInBook: number;
  // Industry fallback (always populated for the asset class)
  industryBenchmark: IndustryBenchmark | null;
  industryPredictedRecoveryUsd: number;
  // Top recommendation (null when cold-start across the board)
  topRecommendation: ServicerMatch | null;
  // Cold-start guidance (true when no servicer has matching history)
  isColdStart: boolean;
  headline: string;
};

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export function matchServicersForTape(
  tape: MatcherTape,
  holdings: MatcherHolding[],
  collections: HoldingCollections[]
): ServicerMatchReport {
  const collectionsByHolding = new Map<string, HoldingCollections>();
  for (const c of collections) collectionsByHolding.set(c.holdingId, c);

  // Index holdings by servicer
  const byServicer = new Map<string, MatcherHolding[]>();
  for (const h of holdings) {
    const key = (h.servicer || "").trim() || "(no servicer)";
    if (!byServicer.has(key)) byServicer.set(key, []);
    byServicer.get(key)!.push(h);
  }
  const totalServicersInBook = byServicer.size;

  const tapeAssetClass = normalizeAssetClass(tape.assetClass);

  const matches: ServicerMatch[] = [];
  for (const [servicer, list] of byServicer) {
    // Filter to holdings that match the tape's asset class (the strongest
    // signal). Vintage and face are secondary.
    const sameClass = list.filter(
      (h) => normalizeAssetClass(h.assetClass) === tapeAssetClass
    );
    if (sameClass.length === 0) continue; // no comparable history for this servicer

    // Compute realized cents-per-purchase-dollar per matching holding
    const realizedCpdValues: number[] = [];
    let totalPaid = 0;
    let totalCollected = 0;
    let matchedFace = 0;
    for (const h of sameClass) {
      const c = collectionsByHolding.get(h.id);
      const collected = c ? c.remittances.reduce((s, r) => s + (Number(r.amountUsd) || 0), 0) : 0;
      totalCollected += collected;
      totalPaid += h.purchasePriceUsd;
      matchedFace += h.faceValueUsd;
      if (h.purchasePriceUsd > 0 && collected > 0) {
        realizedCpdValues.push((collected / h.purchasePriceUsd) * 100);
      }
    }
    const medianRealizedCpd = realizedCpdValues.length > 0 ? median(realizedCpdValues) : 0;

    // Predicted recovery on the NEW tape: assume operator pays a similar
    // purchase price (we don't know what they'll pay yet, so we project
    // gross recovery from FACE × median-realized-recovery-rate-of-face).
    // Compute median-realized-recovery-rate-of-face instead:
    const realizedFaceRateValues: number[] = [];
    for (const h of sameClass) {
      const c = collectionsByHolding.get(h.id);
      const collected = c ? c.remittances.reduce((s, r) => s + (Number(r.amountUsd) || 0), 0) : 0;
      if (h.faceValueUsd > 0 && collected > 0) {
        realizedFaceRateValues.push((collected / h.faceValueUsd) * 100);
      }
    }
    const medianFaceRate = realizedFaceRateValues.length > 0 ? median(realizedFaceRateValues) : 0;
    const predictedGross = tape.faceValueUsd * (medianFaceRate / 100);

    const notes: string[] = [];
    if (sameClass.length < MIN_HOLDINGS_FOR_MEDIUM) {
      notes.push(`Small sample (${sameClass.length} holding${sameClass.length === 1 ? "" : "s"}) — high variance.`);
    }
    if (realizedCpdValues.length < sameClass.length) {
      const noColl = sameClass.length - realizedCpdValues.length;
      notes.push(`${noColl} holding${noColl === 1 ? "" : "s"} have no collections logged yet.`);
    }
    // Check for outlier sensitivity: if 1 holding dominates >70% of the realized values, flag it
    if (realizedCpdValues.length >= 2) {
      const sorted = [...realizedCpdValues].sort((a, b) => b - a);
      const topShare = sorted[0] / sorted.reduce((s, v) => s + v, 0);
      if (topShare > 0.7) notes.push("Median heavily influenced by one outlier holding.");
    }

    matches.push({
      servicer,
      matchedHoldings: sameClass.length,
      matchedHoldingFaceUsd: matchedFace,
      totalPaidUsd: totalPaid,
      totalCollectedUsd: totalCollected,
      medianRealizedCentsPerDollar: medianRealizedCpd,
      predictedRecoveryUsdGross: predictedGross,
      confidence: confidenceFor(sameClass.length),
      rank: 0, // assigned after sort
      notes,
    });
  }

  // Rank by predicted recovery (descending)
  matches.sort((a, b) => b.predictedRecoveryUsdGross - a.predictedRecoveryUsdGross);
  matches.forEach((m, i) => (m.rank = i + 1));

  // Industry fallback
  const industryBenchmark = industryBenchmarkFor(tape.assetClass);
  const industryPredictedRecoveryUsd = industryBenchmark
    ? tape.faceValueUsd * (industryBenchmark.medianRecoveryCentsPerFaceDollar / 100)
    : 0;

  const isColdStart = matches.length === 0;
  const topRecommendation = !isColdStart ? matches[0] : null;

  // Headline
  let headline: string;
  if (isColdStart) {
    if (industryBenchmark) {
      headline = `No matching servicer history for ${tape.assetClass}. Industry median: ${industryBenchmark.medianRecoveryCentsPerFaceDollar.toFixed(1)}¢/$ of face (${industryBenchmark.note}) → predicted gross recovery ~${formatUsdShort(industryPredictedRecoveryUsd)}.`;
    } else {
      headline = `Cold start: no comparable history. Log placements + collections in /app/portfolio to build this model.`;
    }
  } else if (topRecommendation && topRecommendation.confidence === "high") {
    headline = `Recommended: ${topRecommendation.servicer} (${topRecommendation.matchedHoldings} matching holdings, ${topRecommendation.medianRealizedCentsPerDollar.toFixed(1)}¢/$ realized on cost). Projected gross recovery ${formatUsdShort(topRecommendation.predictedRecoveryUsdGross)}.`;
  } else if (topRecommendation) {
    headline = `Tentative pick: ${topRecommendation.servicer} (${topRecommendation.matchedHoldings} matching holding${topRecommendation.matchedHoldings === 1 ? "" : "s"} — ${topRecommendation.confidence} confidence). Projected gross recovery ${formatUsdShort(topRecommendation.predictedRecoveryUsdGross)}.`;
  } else {
    headline = "Insufficient comparable history.";
  }

  return {
    tape,
    matches,
    totalServicersInBook,
    industryBenchmark,
    industryPredictedRecoveryUsd,
    topRecommendation,
    isColdStart,
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
