// Capital envelope — pure function that answers the single question
// "what can I safely bid this week?" given everything the operator already
// has in the app:
//
//   - Current capital state (total / deployed / committed / available)
//   - Owned portfolio (state of the book today, asset-class concentration)
//   - Live pipeline (deals being considered, with ask prices)
//   - Concentration policy (max % per state / vintage / asset class)
//   - License map (which states the operator can legally collect in)
//
// V1 scope: deal-level capital fit + asset-class concentration projection.
// Per-state license matching at the deal level requires per-deal state
// distribution which the pipeline doesn't currently carry — that joins to
// Tape Copilot data downstream. V1 surfaces "this deal's asset class is
// not licensed" only when we can infer the state from the bankKey or
// notes (best-effort).
//
// Pure / no localStorage reads / no fetches. Caller assembles the inputs.

import type { Deal } from "./pipeline";
import type { ConcentrationPolicy } from "./tape-concentration-policy";
import type { EffectiveLicenseMap } from "./tape-license-map";

// ---------------------------------------------------------------------------
// Input shapes (intersection of what callers already have on hand)
// ---------------------------------------------------------------------------

// Lightweight holding shape — caller projects their full portfolio Holding
// objects down to just what the envelope needs. Keeps the module decoupled
// from the portfolio module's full Holding type.
export type EnvelopeHolding = {
  purchasePriceUsd: number;
  faceValueUsd: number;
  assetClass: string;
  vintageYear?: number;
};

export type EnvelopeInput = {
  totalCapital: number;
  deployedCapital: number; // sum of purchase prices on owned holdings
  committedCapital: number; // sum of live bids in "bidding" stage
  availableCapital: number; // total - deployed - committed
  ownedHoldings: EnvelopeHolding[];
  pipelineDeals: Deal[];
  concentrationPolicy: ConcentrationPolicy | null;
  effectiveLicense: EffectiveLicenseMap;
};

// ---------------------------------------------------------------------------
// Per-deal evaluation
// ---------------------------------------------------------------------------

export type DealFitFlag = "ok" | "warn" | "block";

export type DealFit = {
  dealId: string;
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  // The bid price this evaluation assumes — taken from bidCentsPerDollar
  // if set, otherwise askCentsPerDollar, otherwise 0 (we report "no price").
  assumedBidCentsPerDollar: number | null;
  assumedBidDollars: number;
  // Capital fit
  capitalFit: DealFitFlag;
  capitalNote: string;
  // Asset-class concentration projection if won
  postWinAssetClassPct: number;
  concentrationFit: DealFitFlag;
  concentrationNote: string;
  // License hint (best-effort; depends on whether deal carries a state)
  licenseHint?: string;
  overallFit: DealFitFlag;
};

export type AssetClassExposure = {
  assetClass: string;
  currentFaceUsd: number;
  currentPct: number;
  currentSpendUsd: number;
  // After winning every "active" deal in the pipeline
  postWinFaceUsd: number;
  postWinPct: number;
  // Breach against policy?
  breachesPolicy: boolean;
};

export type CapitalEnvelopeReport = {
  // Mirror of existing capital state — useful for the UI to keep numbers
  // consistent on one screen.
  totalCapital: number;
  deployedCapital: number;
  committedCapital: number;
  availableCapital: number;

  // Pipeline overview
  activeDeals: Deal[]; // sourced/reviewing/underwriting/bidding
  activeDealsCount: number;
  // Sum of (face × bid) across active deals — what winning everything costs.
  hypotheticalIfWinAll: number;
  // available - hypotheticalIfWinAll. Negative = over-committed if all win.
  availableAfterWinAll: number;
  willOverCommitIfWinAll: boolean;

  // Per-deal evaluation
  deals: DealFit[];
  // Quick-pick: deals that have no warnings/blockers — "you can safely bid
  // these without changing anything."
  safeBidIds: string[];
  blockedBidIds: string[];

  // Asset-class concentration (current vs. post-win)
  assetClassExposure: AssetClassExposure[];

  // Headline recommendation (one sentence)
  headline: string;
};

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export function computeCapitalEnvelope(input: EnvelopeInput): CapitalEnvelopeReport {
  const active = input.pipelineDeals.filter(
    (d) =>
      d.stage === "sourced" ||
      d.stage === "reviewing" ||
      d.stage === "underwriting" ||
      d.stage === "bidding"
  );

  // Current asset-class exposure from owned holdings (face value-weighted).
  const exposureMap = new Map<string, { face: number; spend: number }>();
  for (const h of input.ownedHoldings) {
    const cur = exposureMap.get(h.assetClass) ?? { face: 0, spend: 0 };
    cur.face += h.faceValueUsd || 0;
    cur.spend += h.purchasePriceUsd || 0;
    exposureMap.set(h.assetClass, cur);
  }
  const currentTotalFace =
    Array.from(exposureMap.values()).reduce((s, e) => s + e.face, 0) || 0;

  // Project post-win face by adding active deals' face values
  // (categorized by their asset class string).
  const postWinExposureMap = new Map<string, number>();
  for (const [k, v] of exposureMap) postWinExposureMap.set(k, v.face);
  for (const d of active) {
    const cls = d.assetClass || "Unspecified";
    postWinExposureMap.set(
      cls,
      (postWinExposureMap.get(cls) ?? 0) + (d.faceValueUsd || 0)
    );
  }
  const postWinTotalFace =
    Array.from(postWinExposureMap.values()).reduce((s, v) => s + v, 0) || 0;

  // Build per-asset exposure rows + breach flag
  const assetClassMaxPct = input.concentrationPolicy?.maxPctPerAssetClass ?? null;
  const assetClassExposure: AssetClassExposure[] = Array.from(
    new Set([...exposureMap.keys(), ...postWinExposureMap.keys()])
  )
    .map((cls) => {
      const cur = exposureMap.get(cls) ?? { face: 0, spend: 0 };
      const postFace = postWinExposureMap.get(cls) ?? 0;
      const currentPct =
        currentTotalFace > 0 ? (cur.face / currentTotalFace) * 100 : 0;
      const postPct =
        postWinTotalFace > 0 ? (postFace / postWinTotalFace) * 100 : 0;
      const breaches = assetClassMaxPct !== null ? postPct > assetClassMaxPct : false;
      return {
        assetClass: cls,
        currentFaceUsd: cur.face,
        currentPct,
        currentSpendUsd: cur.spend,
        postWinFaceUsd: postFace,
        postWinPct: postPct,
        breachesPolicy: breaches,
      };
    })
    .sort((a, b) => b.postWinFaceUsd - a.postWinFaceUsd);

  // Per-deal evaluation
  const deals: DealFit[] = [];
  let hypotheticalIfWinAll = 0;
  let runningAvailable = input.availableCapital;
  for (const d of active) {
    const cents = d.bidCentsPerDollar ?? d.askCentsPerDollar ?? null;
    const face = d.faceValueUsd || 0;
    const bidDollars = cents !== null ? face * (cents / 100) : 0;

    // Capital fit
    let capitalFit: DealFitFlag = "ok";
    let capitalNote = "";
    if (cents === null) {
      capitalFit = "warn";
      capitalNote = "No price set — add bidCentsPerDollar or askCentsPerDollar to evaluate.";
    } else if (bidDollars > input.availableCapital) {
      capitalFit = "block";
      capitalNote = `Bid of ${fmtUsd(bidDollars)} exceeds available capital of ${fmtUsd(input.availableCapital)}.`;
    } else if (bidDollars > runningAvailable) {
      capitalFit = "warn";
      capitalNote = `Bid of ${fmtUsd(bidDollars)} fits today, but if earlier-priority deals win you'd be over by ${fmtUsd(bidDollars - runningAvailable)}.`;
    } else if (bidDollars > input.availableCapital * 0.4) {
      capitalFit = "warn";
      capitalNote = `Single bid would consume ${((bidDollars / input.availableCapital) * 100).toFixed(0)}% of your available capital — concentration risk.`;
    } else {
      capitalNote = `Fits comfortably: ${fmtUsd(bidDollars)} of ${fmtUsd(input.availableCapital)} available.`;
    }
    if (cents !== null) runningAvailable -= bidDollars;
    hypotheticalIfWinAll += bidDollars;

    // Asset-class concentration impact
    const cls = d.assetClass || "Unspecified";
    const postWinAssetClassPct = postWinTotalFace > 0
      ? ((postWinExposureMap.get(cls) ?? 0) / postWinTotalFace) * 100
      : 0;
    let concentrationFit: DealFitFlag = "ok";
    let concentrationNote = "";
    if (assetClassMaxPct !== null) {
      if (postWinAssetClassPct > assetClassMaxPct) {
        concentrationFit = "block";
        concentrationNote = `Winning this would push ${cls} to ${postWinAssetClassPct.toFixed(1)}% of book (cap: ${assetClassMaxPct}%).`;
      } else if (postWinAssetClassPct > assetClassMaxPct * 0.85) {
        concentrationFit = "warn";
        concentrationNote = `Winning this puts ${cls} at ${postWinAssetClassPct.toFixed(1)}% (cap: ${assetClassMaxPct}%) — within 15% of breach.`;
      } else {
        concentrationNote = `${cls} ${postWinAssetClassPct.toFixed(1)}% post-win (cap: ${assetClassMaxPct}%).`;
      }
    } else {
      concentrationNote = `No asset-class cap configured — would put ${cls} at ${postWinAssetClassPct.toFixed(1)}%.`;
    }

    // License hint — only when we have license data and the deal carries
    // a state-shaped ticker. We can't reliably geocode arbitrary tickers,
    // so this is intentionally conservative: surface a hint only when
    // the operator has a configured map (so they know what's at stake).
    let licenseHint: string | undefined;
    if (input.effectiveLicense.source !== "none" && input.effectiveLicense.licensedStates.length > 0) {
      licenseHint = `License coverage: per-deal state isn't on the deal record — verify the tape's state mix in /app/tools/tape before bidding.`;
    }

    const overallFit: DealFitFlag =
      capitalFit === "block" || concentrationFit === "block"
        ? "block"
        : capitalFit === "warn" || concentrationFit === "warn"
        ? "warn"
        : "ok";

    deals.push({
      dealId: d.id,
      ticker: d.ticker,
      brokerName: d.brokerName,
      assetClass: cls,
      faceValueUsd: face,
      assumedBidCentsPerDollar: cents,
      assumedBidDollars: bidDollars,
      capitalFit,
      capitalNote,
      postWinAssetClassPct,
      concentrationFit,
      concentrationNote,
      licenseHint,
      overallFit,
    });
  }

  const safeBidIds = deals.filter((d) => d.overallFit === "ok").map((d) => d.dealId);
  const blockedBidIds = deals.filter((d) => d.overallFit === "block").map((d) => d.dealId);
  const availableAfterWinAll = input.availableCapital - hypotheticalIfWinAll;
  const willOverCommit = availableAfterWinAll < 0;

  let headline: string;
  if (active.length === 0) {
    headline = "No active deals in pipeline. Source or move deals into Reviewing to evaluate.";
  } else if (willOverCommit) {
    headline = `Winning all ${active.length} active deals would over-commit by ${fmtUsd(Math.abs(availableAfterWinAll))}. Drop or stagger.`;
  } else if (blockedBidIds.length > 0) {
    headline = `${blockedBidIds.length} deal(s) blocked by capital or concentration. ${safeBidIds.length} safe to bid as-is.`;
  } else if (deals.some((d) => d.overallFit === "warn")) {
    headline = `${safeBidIds.length} of ${active.length} deals are clean; the rest have warnings — review concentration and timing.`;
  } else {
    headline = `All ${active.length} active deals fit your capital and concentration limits.`;
  }

  return {
    totalCapital: input.totalCapital,
    deployedCapital: input.deployedCapital,
    committedCapital: input.committedCapital,
    availableCapital: input.availableCapital,
    activeDeals: active,
    activeDealsCount: active.length,
    hypotheticalIfWinAll,
    availableAfterWinAll,
    willOverCommitIfWinAll: willOverCommit,
    deals,
    safeBidIds,
    blockedBidIds,
    assetClassExposure,
    headline,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}
