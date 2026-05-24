import { BROKERS, type Broker } from "@/lib/brokers";
import { applyRankingLifts, type Lifts } from "@/lib/autopilot/pattern-performance";
import { secBankState, shouldApplyStateRisk } from "@/lib/sec-bank-states";
import type { FdicSignal, NcuaSignal } from "@/lib/snapshot";

/**
 * Layer that turns a raw Call-Report signal into something an operator can
 * actually act on: an estimated annual sellable tape volume in dollars and a
 * short list of best-fit brokers from the curated directory. Pure-function,
 * no I/O — safe to call from server or client code.
 *
 * Industry default sale rate: banks sell roughly half of charged-off paper
 * (the rest they collect internally or write off). This number is a sober
 * starting estimate, not a forecast — actual sale volume depends on the
 * bank's recovery economics and panel-buyer relationships.
 */

const SALE_RATE = 0.5;

export type TapeSize = "small" | "mid" | "large" | "xlarge";

const SIZE_LABEL: Record<TapeSize, string> = {
  small: "Small tape · ~<$1M/yr",
  mid: "Mid tape · ~$1–10M/yr",
  large: "Large tape · ~$10–100M/yr",
  xlarge: "Very large · >$100M/yr",
};

function sizeBucket(usd: number): TapeSize {
  if (usd >= 100_000_000) return "xlarge";
  if (usd >= 10_000_000) return "large";
  if (usd >= 1_000_000) return "mid";
  return "small";
}

/**
 * Call Reports report charge-off values as year-to-date at period_end.
 * Q4 (December) carries the full year; mid-year quarters need annualizing.
 */
function quarterFraction(periodEnd: string): number {
  const month = parseInt(periodEnd.slice(5, 7), 10);
  if (month === 3) return 0.25;
  if (month === 6) return 0.5;
  if (month === 9) return 0.75;
  return 1.0; // Q4 or unknown — treat as full year
}

export type EnrichedSignal = {
  /** Null for delinquency-only signals (no charge-off dollars to annualize). */
  estimatedAnnualChargeOffsUsd: number | null;
  /** Annualized charge-offs × industry sale rate. Null when above is null. */
  estimatedAnnualSellableFaceUsd: number | null;
  tapeSize: TapeSize | null;
  tapeSizeLabel: string | null;
  /** Top 2 brokers from the curated directory, ranked by relationship style
   * (broker-principal / boutique preferred for small institutions) and
   * coverage of the inferred asset class (from breakdown if present). */
  suggestedBrokers: Broker[];
  /** Dominant asset class derived from the per-class breakdown
   * (FDIC charge-off signals only). e.g. "auto", "credit_card". */
  dominantAssetClass: string | null;
  /** Share of total CO from the dominant class, 0–1. */
  dominantAssetShare: number | null;
};

const ASSET_CLASS_HUMAN: Record<string, string> = {
  credit_card: "credit card",
  auto: "auto",
  real_estate: "real estate",
  commercial: "commercial",
};

/** Maps our internal breakdown labels to broker-directory `assetClass[]`
 * values so broker matching can be sharper when a breakdown is available. */
const ASSET_CLASS_BROKER_MATCH: Record<string, string[]> = {
  credit_card: ["credit card"],
  auto: ["auto"],
  real_estate: ["junior mortgage", "second-lien", "real estate notes"],
  commercial: ["commercial"],
};

export function humanAssetClass(internal: string): string {
  return ASSET_CLASS_HUMAN[internal] || internal.replace(/_/g, " ");
}

const PREFERRED_BROKER_TYPES: Broker["type"][] = [
  "broker-principal",
  "boutique",
  "broker",
  "auction-platform",
];

export function enrichSignal(signal: FdicSignal | NcuaSignal): EnrichedSignal {
  const isChargeOff = signal.signal_type === "charge_off_increase";
  let estimatedAnnualChargeOffsUsd: number | null = null;
  let estimatedAnnualSellableFaceUsd: number | null = null;
  let tapeSize: TapeSize | null = null;
  let tapeSizeLabel: string | null = null;

  if (isChargeOff && signal.value > 0 && signal.period_end) {
    const annualized = signal.value / quarterFraction(signal.period_end);
    estimatedAnnualChargeOffsUsd = annualized;
    estimatedAnnualSellableFaceUsd = annualized * SALE_RATE;
    tapeSize = sizeBucket(estimatedAnnualSellableFaceUsd);
    tapeSizeLabel = SIZE_LABEL[tapeSize];
  }

  // Derive dominant asset class from the per-class breakdown if present
  // (FDIC charge-off signals carry it). Falls back to a generic
  // consumer/credit-card/auto broker match when no breakdown is available.
  let dominantAssetClass: string | null = null;
  let dominantAssetShare: number | null = null;
  let preferredAssetClasses: string[] = ["consumer", "credit card", "auto"];
  if (signal.breakdown) {
    const entries = Object.entries(signal.breakdown).filter(
      ([, v]) => typeof v === "number" && v > 0
    );
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total > 0 && entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      const [topLabel, topVal] = entries[0];
      dominantAssetClass = topLabel;
      dominantAssetShare = topVal / total;
      const sharper = ASSET_CLASS_BROKER_MATCH[topLabel];
      if (sharper && sharper.length > 0) preferredAssetClasses = sharper;
    }
  }

  // Match brokers that cover the relevant asset class(es).
  const matches = BROKERS.filter((b) =>
    b.assetClass.some((c) => preferredAssetClasses.includes(c))
  );
  matches.sort((a, b) => {
    const ai = PREFERRED_BROKER_TYPES.indexOf(a.type);
    const bi = PREFERRED_BROKER_TYPES.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return {
    estimatedAnnualChargeOffsUsd,
    estimatedAnnualSellableFaceUsd,
    tapeSize,
    tapeSizeLabel,
    suggestedBrokers: matches.slice(0, 2),
    dominantAssetClass,
    dominantAssetShare,
  };
}

/** $-shorthand: $35M / $850k / $325. */
export function formatUsdShort(usd: number): string {
  if (usd >= 1_000_000) {
    return `$${(usd / 1_000_000).toFixed(usd >= 10_000_000 ? 0 : 1)}M`;
  }
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}k`;
  return `$${Math.round(usd)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// State-level recovery friction. Some states have aggressive consumer-protection
// statutes (NY, CA, MA, MD, IL, CT) that compress recovery rates; others (TX,
// FL, GA, NC, AZ, TN) are operator-friendly. Everywhere else: neutral.
// This is industry knowledge a new buyer often learns the hard way after one
// bad tape — surfacing it before outreach is the kind of free intel the radar
// should give you.

export type StateRiskLevel = "tough" | "neutral" | "friendly";

const STATE_RISK_MAP: Record<string, StateRiskLevel> = {
  CA: "tough",
  NY: "tough",
  MA: "tough",
  MD: "tough",
  CT: "tough",
  IL: "tough",
  NJ: "tough",
  TX: "friendly",
  FL: "friendly",
  GA: "friendly",
  NC: "friendly",
  AZ: "friendly",
  TN: "friendly",
  SC: "friendly",
};

export function stateRiskLevel(state: string | undefined | null): StateRiskLevel {
  if (!state) return "neutral";
  return STATE_RISK_MAP[state.toUpperCase()] || "neutral";
}

export function stateRiskNote(state: string | undefined | null): string {
  const level = stateRiskLevel(state);
  if (level === "tough") {
    return `${state} consumer-protection laws compress recovery — discount your expected IRR ~3–5pp vs. national average and price the bid accordingly.`;
  }
  if (level === "friendly") {
    return `${state} is operator-friendly — statute and Reg F enforcement leave room for full-curve recovery.`;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite buyer-fit score. Replaces raw confidence as the primary ranking
// signal — confidence only measures *whether* the bank's metrics moved; fit
// measures whether YOU should care, given size, geography, and signal type.
// Range 0–99. Banks scoring < 50 are "marginal" — sorting them off the top
// of the inbox saves attention.

export type FitScoreContext = {
  /** Required when lifts is passed — FDIC and NCUA share the same signal
   * shape, so audience can't be inferred from the object alone. */
  audience?: "fdic" | "ncua";
  /** Per-dimension lifts from pattern-performance. When omitted, score is
   * pure static features (identical to pre-learning behavior). */
  lifts?: Lifts;
};

export function signalFitScore(
  signal: FdicSignal | NcuaSignal,
  ctx?: FitScoreContext
): number {
  // Base from existing confidence (55–95 typical range).
  let score = signal.confidence * 100;

  // Tape-size tilt. Mid and large tapes carry the best capital efficiency for
  // a solo operator past the first deal — too small wastes overhead, too
  // large is hard to source. (Estimate may be null for delinquency signals.)
  const enriched = enrichSignal(signal);
  if (enriched.tapeSize === "mid") score += 5;
  else if (enriched.tapeSize === "large") score += 8;
  else if (enriched.tapeSize === "xlarge") score += 4;
  else if (enriched.tapeSize === "small") score -= 2;

  // Geographic friction. Tough states cost real dollars in recovery —
  // demote them so easier-state targets surface first when the operator
  // is choosing where to spend outreach effort.
  const risk = stateRiskLevel(signal.state);
  if (risk === "tough") score -= 10;
  else if (risk === "friendly") score += 5;

  // Charge-offs are directly sellable; rising delinquency is a leading
  // indicator (loans *going* bad, not yet sold). Slight tilt toward CO.
  if (signal.signal_type === "charge_off_increase") score += 3;

  const adjusted = applyRankingLifts(
    score,
    { audience: ctx?.audience, state: signal.state },
    ctx?.lifts
  );

  return Math.max(0, Math.min(99, adjusted));
}

export type FitTier = "strong" | "worth_a_look" | "marginal";

export function fitTier(score: number): FitTier {
  if (score >= 80) return "strong";
  if (score >= 65) return "worth_a_look";
  return "marginal";
}

export function fitTierLabel(tier: FitTier): string {
  if (tier === "strong") return "Strong fit";
  if (tier === "worth_a_look") return "Worth a look";
  return "Marginal";
}

/** A cert that's been flagged in 2+ distinct quarters — persistent supply
 * signal, much higher buyer interest than a one-time spike. */
export function isPersistent(signal: FdicSignal | NcuaSignal): boolean {
  return (signal.appearances ?? 1) >= 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEC bank enrichment. The SEC stream doesn't carry asset_total per signal
// (XBRL data is per-concept, not per-bank summary), so tape sizing falls
// back to a tier-based heuristic. Sober ranges anchored to public asset
// scales: GSIB ~$2T+, super-regional ~$100B–500B, regional ~$10B–100B.
// Output is intentionally a *range* not a point — too uncertain otherwise.

export type SecTapeEstimate = {
  /** Plain-English range to display. e.g. "$50M–500M/yr typical". */
  rangeLabel: string;
  /** Suggested brokers based on tier + asset_class_focus from seed. */
  suggestedBrokers: Broker[];
  /** True for GSIB tier — these sell to panel buyers only, so cards
   * for them should warn the operator off. */
  panelOnly: boolean;
};

const TIER_RANGE: Record<string, string> = {
  GSIB: "$200M–2B/yr typical (panel buyers only)",
  "super-regional": "$50M–500M/yr typical",
  regional: "$5M–50M/yr typical",
  specialty: "$2M–25M/yr typical",
  fintech: "$1M–15M/yr typical",
  mortgage: "$5M–100M/yr typical (mostly junior-lien)",
  student: "$2M–20M/yr typical",
  community: "<$5M/yr typical",
};

/** Maps seed asset_class_focus → broker-directory asset-class values. */
const SEC_FOCUS_BROKER_MATCH: Record<string, string[]> = {
  multi: ["consumer", "credit card", "auto"],
  consumer: ["consumer", "credit card"],
  "credit-card": ["credit card"],
  auto: ["auto"],
  mortgage: ["junior mortgage", "second-lien", "real estate notes"],
  student: ["consumer"],
  commercial: ["commercial"],
  specialty: ["consumer"],
};

export function enrichSecOriginator(
  o: { tier?: string | null; asset_class_focus?: string | null }
): SecTapeEstimate {
  const tier = (o.tier || "regional").trim();
  const focus = (o.asset_class_focus || "multi").trim().toLowerCase();
  const rangeLabel = TIER_RANGE[tier] || "size unknown";
  const panelOnly = tier === "GSIB";

  const preferred = SEC_FOCUS_BROKER_MATCH[focus] || ["consumer"];
  const matches = BROKERS.filter((b) =>
    b.assetClass.some((c) => preferred.includes(c))
  );
  // For SEC banks, prefer auction platforms + broker-principals (they handle
  // the larger SEC-filer paper that doesn't go to small relationship shops).
  const secTierOrder: Broker["type"][] = [
    "auction-platform",
    "broker-principal",
    "broker",
    "boutique",
  ];
  matches.sort((a, b) => {
    const ai = secTierOrder.indexOf(a.type);
    const bi = secTierOrder.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return {
    rangeLabel,
    suggestedBrokers: matches.slice(0, 2),
    panelOnly,
  };
}
