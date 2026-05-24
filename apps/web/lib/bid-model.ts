"use client";

/**
 * Pre-computed bid recommendation for a pipeline deal. Mirrors the NPV
 * formula in `/app/tools/bid-calculator`:
 *
 *   netToBuyer = face × recovery × (1 − servicerFee)
 *   maxBid     = netToBuyer / (1 + IRR) ^ years
 *   disciplinedBid = 0.85 × maxBid    (15% margin for surprises)
 *
 * Lives in `lib` so the inbox proposal generator can produce bid cards
 * without spinning up the full calculator component. Operators still tune
 * inputs in the calculator UI; the inbox card is a *suggested* number with
 * the math attached so they can decide in one glance whether the deal is
 * even worth opening the calculator for.
 */

export type AssetModelParams = {
  recoveryPct: number;
  workoutMonths: number;
  servicerFeePct: number;
};

/** Per-asset-class defaults — illustrative; the calculator's per-asset
 * presets use the same shape so cards line up with what the operator sees
 * when they open the calculator. */
export const ASSET_BID_MODEL: Record<string, AssetModelParams> = {
  "Credit card": { recoveryPct: 14, workoutMonths: 30, servicerFeePct: 30 },
  Auto: { recoveryPct: 35, workoutMonths: 24, servicerFeePct: 30 },
  "Junior mortgage": {
    recoveryPct: 45,
    workoutMonths: 48,
    servicerFeePct: 35,
  },
  Medical: { recoveryPct: 8, workoutMonths: 36, servicerFeePct: 40 },
  Commercial: { recoveryPct: 25, workoutMonths: 36, servicerFeePct: 30 },
  "Tax lien": { recoveryPct: 90, workoutMonths: 24, servicerFeePct: 25 },
  Specialty: { recoveryPct: 15, workoutMonths: 36, servicerFeePct: 30 },
};

const DEFAULT_MODEL: AssetModelParams = {
  recoveryPct: 15,
  workoutMonths: 30,
  servicerFeePct: 30,
};

/** Target IRR for the discount rate — what return the buyer demands on the
 * outlay over the work-out period. Conservative-side default for first-tape
 * buyers; sharper operators tune lower as their model gets more confident. */
export const TARGET_IRR_PCT = 25;

/** Apply a 15% margin under the math-pure max to leave room for surprise
 * skips, prior-sale degradation, doc gaps. The playbook is explicit about
 * pricing discipline — disciplined bid is the number to actually offer. */
export const DISCIPLINE_FACTOR = 0.85;

export function modelFor(assetClass: string): AssetModelParams {
  return ASSET_BID_MODEL[assetClass] || DEFAULT_MODEL;
}

export type BidRecommendation = {
  faceValueUsd: number;
  assetClass: string;
  recoveryPct: number;
  workoutMonths: number;
  servicerFeePct: number;
  targetIrrPct: number;
  grossRecoveryUsd: number;
  netToBuyerUsd: number;
  maxBidUsd: number;
  disciplinedBidUsd: number;
  disciplinedCents: number;
};

export function computeBid(
  faceValueUsd: number,
  assetClass: string
): BidRecommendation {
  const m = modelFor(assetClass);
  const grossRecoveryUsd = faceValueUsd * (m.recoveryPct / 100);
  const netToBuyerUsd = grossRecoveryUsd * (1 - m.servicerFeePct / 100);
  const years = m.workoutMonths / 12;
  const discount = Math.pow(1 + TARGET_IRR_PCT / 100, years);
  const maxBidUsd = netToBuyerUsd / discount;
  const disciplinedBidUsd = maxBidUsd * DISCIPLINE_FACTOR;
  const disciplinedCents =
    faceValueUsd > 0 ? (disciplinedBidUsd / faceValueUsd) * 100 : 0;
  return {
    faceValueUsd,
    assetClass: assetClass || "consumer",
    recoveryPct: m.recoveryPct,
    workoutMonths: m.workoutMonths,
    servicerFeePct: m.servicerFeePct,
    targetIrrPct: TARGET_IRR_PCT,
    grossRecoveryUsd,
    netToBuyerUsd,
    maxBidUsd,
    disciplinedBidUsd,
    disciplinedCents,
  };
}
