import "server-only";

import { readLog, type AutopilotLogEntry, type Outcome } from "./state";

/**
 * Outcome-based learning loop. Reads autopilot-log.json, auto-resolves
 * stale "sent" entries to no_reply after 14d, then computes per-dimension
 * reply-rate lifts vs. the global mean. The lifts are folded into
 * signalFitScore at proposal-ranking time so the daily top-card reflects
 * what actually worked, not just static features.
 *
 * Conservative by design:
 *   • dimensions with < MIN_SAMPLES rows fall through to zero lift
 *   • per-dimension lifts are clamped to ±MAX_LIFT_MAGNITUDE
 *   • aggregate lift on a single proposal is clamped to the same magnitude
 *     so one outlier dimension can't dominate ranking
 *   • runs in ~one read of a 500-entry JSON file — no DB, no extra infra
 *
 * Not yet wired:
 *   • won_deal / lost_deal credit from pipeline transitions (step 3)
 *   • dashboard surfaces (step 4)
 */

const AUTO_NO_REPLY_DAYS = 14;
const MIN_SAMPLES_PER_DIMENSION_VALUE = 20;
const MAX_LIFT_MAGNITUDE = 0.3;

/** Dimensions we can rank proposals on (audience + state) and dimensions
 * useful only for "best send time" insights (dow + hour). Kept in one
 * lifts object so callers can pick what's relevant. */
export type RankingDimension = "audience" | "state";
export type TimingDimension = "dow" | "hour";
export type Dimension = RankingDimension | TimingDimension;

export type Lifts = Partial<Record<Dimension, Record<string, number>>>;

export type PatternStats = {
  /** Number of "sent" entries with a determinable outcome (explicit label
   * OR auto no_reply). The denominator for every dimension's reply rate. */
  decisiveCount: number;
  /** Global reply rate (replied | won_deal) / decisiveCount. */
  globalReplyRate: number;
  lifts: Lifts;
  /** Per-dimension value → { total, positive } so the dashboard can render
   * "X reply rate (Y of Z)" without re-walking the log. */
  buckets: Record<Dimension, Record<string, { total: number; positive: number }>>;
};

function featuresFor(entry: AutopilotLogEntry): Record<Dimension, string | null> {
  const d = new Date(entry.ts);
  const valid = Number.isFinite(d.getTime());
  return {
    audience: entry.audience,
    state: entry.state ? entry.state.toUpperCase() : null,
    dow: valid ? String(d.getUTCDay()) : null,
    hour: valid ? String(d.getUTCHours()) : null,
  };
}

function autoOutcome(entry: AutopilotLogEntry, nowMs: number): Outcome | null {
  const sentMs = new Date(entry.ts).getTime();
  if (!Number.isFinite(sentMs)) return null;
  const daysSince = (nowMs - sentMs) / (1000 * 60 * 60 * 24);
  return daysSince >= AUTO_NO_REPLY_DAYS ? "no_reply" : null;
}

function isPositive(outcome: Outcome): boolean {
  return outcome === "replied" || outcome === "won_deal";
}

function clamp(n: number, mag: number): number {
  return Math.max(-mag, Math.min(mag, n));
}

export async function computePatternStats(
  log?: AutopilotLogEntry[]
): Promise<PatternStats> {
  const entries = log ?? (await readLog());
  const now = Date.now();

  const decisive: { entry: AutopilotLogEntry; positive: boolean }[] = [];
  for (const e of entries) {
    if (e.status !== "sent") continue;
    const outcome = e.outcome ?? autoOutcome(e, now);
    if (!outcome) continue;
    decisive.push({ entry: e, positive: isPositive(outcome) });
  }

  const empty: PatternStats = {
    decisiveCount: 0,
    globalReplyRate: 0,
    lifts: {},
    buckets: { audience: {}, state: {}, dow: {}, hour: {} },
  };

  if (decisive.length === 0) return empty;

  const positiveCount = decisive.filter((d) => d.positive).length;
  const globalReplyRate = positiveCount / decisive.length;

  // No positives at all → no signal to lift on; return raw buckets only.
  if (globalReplyRate === 0) {
    return {
      ...empty,
      decisiveCount: decisive.length,
      buckets: bucketize(decisive),
    };
  }

  const buckets = bucketize(decisive);
  const lifts: Lifts = {};
  const dimensions: Dimension[] = ["audience", "state", "dow", "hour"];
  for (const dim of dimensions) {
    const dimLifts: Record<string, number> = {};
    for (const [value, { total, positive }] of Object.entries(buckets[dim])) {
      if (total < MIN_SAMPLES_PER_DIMENSION_VALUE) continue;
      const rate = positive / total;
      const lift = (rate - globalReplyRate) / globalReplyRate;
      dimLifts[value] = clamp(lift, MAX_LIFT_MAGNITUDE);
    }
    if (Object.keys(dimLifts).length > 0) lifts[dim] = dimLifts;
  }

  return {
    decisiveCount: decisive.length,
    globalReplyRate,
    lifts,
    buckets,
  };
}

function bucketize(
  decisive: { entry: AutopilotLogEntry; positive: boolean }[]
): PatternStats["buckets"] {
  const out: PatternStats["buckets"] = {
    audience: {},
    state: {},
    dow: {},
    hour: {},
  };
  for (const { entry, positive } of decisive) {
    const features = featuresFor(entry);
    for (const dim of ["audience", "state", "dow", "hour"] as Dimension[]) {
      const value = features[dim];
      if (!value) continue;
      const bucket = out[dim][value] ?? { total: 0, positive: 0 };
      bucket.total++;
      if (positive) bucket.positive++;
      out[dim][value] = bucket;
    }
  }
  return out;
}

/**
 * Apply ranking-dimension lifts to a static score. Only audience + state
 * are read — dow/hour describe when-to-send, not which-to-rank. Aggregate
 * lift is clamped to ±MAX_LIFT_MAGNITUDE so a +30% audience + +30% state
 * still tops out at +30% total, never 60%.
 */
export function applyRankingLifts(
  baseScore: number,
  features: Partial<Record<RankingDimension, string>>,
  lifts: Lifts | undefined
): number {
  if (!lifts) return baseScore;
  let total = 0;
  for (const dim of ["audience", "state"] as RankingDimension[]) {
    const value = features[dim];
    if (!value) continue;
    const v = lifts[dim]?.[value.toUpperCase()] ?? lifts[dim]?.[value];
    if (typeof v === "number") total += v;
  }
  return Math.round(baseScore * (1 + clamp(total, MAX_LIFT_MAGNITUDE)));
}

/** Sample-size threshold a dimension value must hit before contributing
 * lift. Exported so the dashboard can show "X more sends needed" hints. */
export const MIN_SAMPLES = MIN_SAMPLES_PER_DIMENSION_VALUE;
