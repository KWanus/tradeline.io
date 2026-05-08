// Track record — Tradeline's "we predicted this divestiture; it happened"
// ledger. Per the competitive research (docs/COMPETITIVE_LANDSCAPE.md
// recommended Feature #2), this turns the Radar from a feed into a
// falsifiable signal customers can show their LP / credit committee.
//
// Schema is hand-curated for Phase 1 (manual entry when the operator spots
// a Radar-flagged bank actually listing on EverChain / Debexpert / NLEX /
// any auction venue). Phase 2 will ingest those venues via webhook + match
// automatically; the data shape stays the same.

export type PredictionStatus = "pending" | "matched" | "expired";

// What Radar flagged.
export type Prediction = {
  id: string;
  ticker: string;                  // originator
  signalType: string;              // signal that fired (charge_off_increase, etc.)
  confidence: number;              // 0–1
  flaggedAt: string;               // ISO date Radar first scored this
  predictedAssetClass: string;     // best-guess asset class
  predictedFaceMin: number;        // expected min face value, USD
  predictedFaceMax: number;        // expected max face value, USD
  predictedRegion: string;         // geographic concentration guess
  expectedListingByDays: number;   // operator's guess at days until listing
  status: PredictionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

// What actually happened.
export type Match = {
  id: string;
  predictionId: string;            // FK to Prediction
  venue: string;                   // EverChain / Debexpert / NLEX / Garnet / private
  listedAt: string;                // ISO date the listing went up
  actualAssetClass: string;
  actualFaceUsd: number;
  actualRegion: string;
  notes: string;
  // Computed at write time
  matchScoreNumeric: number;       // 0–1 composite
  daysFromFlagToListing: number;
  createdAt: string;
};

// ─── Scoring ───────────────────────────────────────────────────────────
// Match score is a weighted sum: asset class match (40%), face value within
// predicted range (30%), region overlap (20%), recency (10%).

function assetClassMatch(predicted: string, actual: string): number {
  if (!predicted || !actual) return 0;
  const p = predicted.toLowerCase().trim();
  const a = actual.toLowerCase().trim();
  if (p === a) return 1;
  // Allow loose matches between similar classes
  if (p.includes("credit card") && a.includes("credit card")) return 1;
  if (p.includes("auto") && a.includes("auto")) return 1;
  if (
    (p.includes("mortgage") || p.includes("real estate")) &&
    (a.includes("mortgage") || a.includes("real estate"))
  )
    return 1;
  if (p.includes("commercial") && a.includes("commercial")) return 1;
  if (p.includes("medical") && a.includes("medical")) return 1;
  return 0;
}

function faceMatch(min: number, max: number, actual: number): number {
  if (!actual || actual <= 0) return 0;
  if (min <= 0 && max <= 0) return 0.5;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (actual >= lo && actual <= hi) return 1;
  // Outside but within 30% — partial credit
  const distance = actual < lo ? (lo - actual) / lo : (actual - hi) / hi;
  if (distance < 0.3) return 0.7;
  if (distance < 0.6) return 0.4;
  return 0.1;
}

function regionMatch(predicted: string, actual: string): number {
  if (!predicted || !actual) return 0;
  const p = predicted.toLowerCase().trim();
  const a = actual.toLowerCase().trim();
  if (p === a) return 1;
  // Substring check — e.g. "mid-atlantic" overlaps "VA, MD, NC"
  const pTokens = p.split(/[\s,/]+/).filter(Boolean);
  const aTokens = a.split(/[\s,/]+/).filter(Boolean);
  const overlap = pTokens.filter((t) => aTokens.includes(t)).length;
  if (overlap > 0) return Math.min(1, overlap / Math.max(pTokens.length, aTokens.length));
  return 0.2;
}

function recencyMatch(daysFromFlagToListing: number): number {
  if (daysFromFlagToListing < 0) return 0; // listing pre-dates the flag
  if (daysFromFlagToListing <= 30) return 1.0;
  if (daysFromFlagToListing <= 90) return 0.85;
  if (daysFromFlagToListing <= 180) return 0.65;
  if (daysFromFlagToListing <= 365) return 0.4;
  return 0.15;
}

export function computeMatchScore(
  prediction: Prediction,
  partial: { actualAssetClass: string; actualFaceUsd: number; actualRegion: string; listedAt: string }
): { score: number; daysFromFlagToListing: number } {
  const days = Math.max(
    0,
    Math.round(
      (new Date(partial.listedAt).getTime() -
        new Date(prediction.flaggedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
  const a = assetClassMatch(prediction.predictedAssetClass, partial.actualAssetClass);
  const f = faceMatch(
    prediction.predictedFaceMin,
    prediction.predictedFaceMax,
    partial.actualFaceUsd
  );
  const r = regionMatch(prediction.predictedRegion, partial.actualRegion);
  const t = recencyMatch(days);
  const score = a * 0.4 + f * 0.3 + r * 0.2 + t * 0.1;
  return { score: Math.round(score * 100) / 100, daysFromFlagToListing: days };
}

// ─── Aggregate stats ───────────────────────────────────────────────────

export type TrackRecordStats = {
  totalPredictions: number;
  matched: number;
  pending: number;
  expired: number;
  hitRate: number;             // matched / (matched + expired)
  avgMatchScore: number;       // average over matched
  avgLeadTimeDays: number;     // avg days from flag to listing on matched
  highConfidenceHits: number;  // matched with score >= 0.7
};

export function computeStats(
  predictions: Prediction[],
  matches: Match[]
): TrackRecordStats {
  const totalPredictions = predictions.length;
  const matched = predictions.filter((p) => p.status === "matched").length;
  const pending = predictions.filter((p) => p.status === "pending").length;
  const expired = predictions.filter((p) => p.status === "expired").length;
  const denominator = matched + expired;
  const hitRate = denominator === 0 ? 0 : matched / denominator;

  const matchScores = matches.map((m) => m.matchScoreNumeric);
  const avgMatchScore =
    matchScores.length === 0
      ? 0
      : matchScores.reduce((a, b) => a + b, 0) / matchScores.length;

  const leadTimes = matches.map((m) => m.daysFromFlagToListing);
  const avgLeadTimeDays =
    leadTimes.length === 0
      ? 0
      : leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;

  const highConfidenceHits = matches.filter((m) => m.matchScoreNumeric >= 0.7).length;

  return {
    totalPredictions,
    matched,
    pending,
    expired,
    hitRate,
    avgMatchScore,
    avgLeadTimeDays,
    highConfidenceHits,
  };
}

// ─── Storage ───────────────────────────────────────────────────────────

export const PREDICTIONS_STORAGE_KEY = "tradeline.predictions.v1";
export const MATCHES_STORAGE_KEY = "tradeline.matches.v1";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadPredictions(): Prediction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PREDICTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Prediction[]) : [];
  } catch {
    return [];
  }
}

export function savePredictions(predictions: Prediction[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PREDICTIONS_STORAGE_KEY,
    JSON.stringify(predictions)
  );
}

export function loadMatches(): Match[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MATCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Match[]) : [];
  } catch {
    return [];
  }
}

export function saveMatches(matches: Match[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(matches));
}

// ─── Demo data ─────────────────────────────────────────────────────────

const DEMO_NOW = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const DEMO_PREDICTIONS: Omit<Prediction, "id" | "createdAt" | "updatedAt">[] = [
  {
    ticker: "FITB",
    signalType: "charge_off_increase",
    confidence: 0.85,
    flaggedAt: daysAgo(72),
    predictedAssetClass: "Credit card",
    predictedFaceMin: 30_000_000,
    predictedFaceMax: 80_000_000,
    predictedRegion: "Midwest, Mid-Atlantic",
    expectedListingByDays: 90,
    status: "matched",
    notes:
      "Q2 2025 10-Q showed +47% YoY charge-off growth in CC segment. Tier-2 originator; historically uses Garnet for sales.",
  },
  {
    ticker: "WAL",
    signalType: "reserve_build",
    confidence: 0.78,
    flaggedAt: daysAgo(45),
    predictedAssetClass: "Commercial",
    predictedFaceMin: 50_000_000,
    predictedFaceMax: 150_000_000,
    predictedRegion: "Southwest, California",
    expectedListingByDays: 120,
    status: "matched",
    notes:
      "Provisioning expense up 38% QoQ. Concentrated in CRE. Watch for DebtX or specialty broker listing.",
  },
  {
    ticker: "FLG",
    signalType: "portfolio_sale_announced",
    confidence: 0.95,
    flaggedAt: daysAgo(28),
    predictedAssetClass: "Junior mortgage",
    predictedFaceMin: 100_000_000,
    predictedFaceMax: 300_000_000,
    predictedRegion: "New York metro",
    expectedListingByDays: 60,
    status: "pending",
    notes:
      "8-K item 2.01 explicitly disclosed portfolio sale program. Already named Kondaur as advisor in earnings call.",
  },
  {
    ticker: "EWBC",
    signalType: "npl_ratio_increase",
    confidence: 0.62,
    flaggedAt: daysAgo(110),
    predictedAssetClass: "Commercial",
    predictedFaceMin: 20_000_000,
    predictedFaceMax: 60_000_000,
    predictedRegion: "California, Pacific Northwest",
    expectedListingByDays: 90,
    status: "expired",
    notes:
      "NPL ratio rose Q1 but stabilized Q2. No listing within prediction window. Either retained or sold privately.",
  },
];

export const DEMO_MATCHES: Omit<Match, "id" | "createdAt">[] = [
  {
    predictionId: "demo-fitb",
    venue: "Garnet Capital",
    listedAt: daysAgo(15),
    actualAssetClass: "Credit card",
    actualFaceUsd: 52_000_000,
    actualRegion: "Mid-Atlantic, Midwest",
    notes:
      "Listed via Garnet on schedule. Asset class + region matched exactly. Face value mid-range of prediction.",
    matchScoreNumeric: 0.93,
    daysFromFlagToListing: 57,
  },
  {
    predictionId: "demo-wal",
    venue: "DebtX",
    listedAt: daysAgo(8),
    actualAssetClass: "Commercial",
    actualFaceUsd: 95_000_000,
    actualRegion: "California",
    notes:
      "DebtX listing matches prediction exactly. Face within range. Region tighter than predicted (no Southwest), but still 1.0 partial overlap.",
    matchScoreNumeric: 0.87,
    daysFromFlagToListing: 37,
  },
];
