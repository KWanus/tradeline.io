import { describe, expect, it } from "vitest";
import {
  ASSET_BID_MODEL,
  DISCIPLINE_FACTOR,
  TARGET_IRR_PCT,
  computeBid,
  modelFor,
} from "./bid-model";

describe("modelFor", () => {
  it("returns the per-asset model for a known class", () => {
    expect(modelFor("Auto")).toEqual(ASSET_BID_MODEL.Auto);
  });

  it("falls back to the default model for an unknown class", () => {
    const m = modelFor("Something exotic");
    expect(m).toEqual({ recoveryPct: 15, workoutMonths: 30, servicerFeePct: 30 });
  });
});

describe("computeBid", () => {
  it("matches the hand-computed NPV for Auto @ $1M face", () => {
    // gross = 1,000,000 × 0.35 = 350,000
    // net   = 350,000 × (1 − 0.30) = 245,000
    // years = 24 / 12 = 2
    // disc  = 1.25^2 = 1.5625
    // max   = 245,000 / 1.5625 = 156,800
    // disc. = 156,800 × 0.85 = 133,280  → 13.328¢/$
    const r = computeBid(1_000_000, "Auto");
    expect(r.grossRecoveryUsd).toBeCloseTo(350_000, 6);
    expect(r.netToBuyerUsd).toBeCloseTo(245_000, 6);
    expect(r.maxBidUsd).toBeCloseTo(156_800, 4);
    expect(r.disciplinedBidUsd).toBeCloseTo(133_280, 4);
    expect(r.disciplinedCents).toBeCloseTo(13.328, 6);
  });

  it("applies the discipline factor strictly below the math-pure max", () => {
    const r = computeBid(500_000, "Credit card");
    expect(r.disciplinedBidUsd).toBeCloseTo(r.maxBidUsd * DISCIPLINE_FACTOR, 6);
    expect(r.disciplinedBidUsd).toBeLessThan(r.maxBidUsd);
  });

  it("uses the configured target IRR as the discount rate", () => {
    const r = computeBid(100_000, "Tax lien");
    const m = ASSET_BID_MODEL["Tax lien"];
    const years = m.workoutMonths / 12;
    const expectedMax =
      (100_000 * (m.recoveryPct / 100) * (1 - m.servicerFeePct / 100)) /
      Math.pow(1 + TARGET_IRR_PCT / 100, years);
    expect(r.maxBidUsd).toBeCloseTo(expectedMax, 4);
  });

  it("does not divide by zero on a zero-face deal", () => {
    const r = computeBid(0, "Auto");
    expect(r.disciplinedCents).toBe(0);
    expect(Number.isFinite(r.disciplinedBidUsd)).toBe(true);
  });
});
