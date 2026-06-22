import { describe, expect, it } from "vitest";
import {
  type HoldingCollections,
  expectedFraction,
  recoveryStatus,
  totalCollected,
} from "./collections";

function holding(over: Partial<HoldingCollections> = {}): HoldingCollections {
  return {
    holdingId: "h1",
    expectedRecoveryPct: 20,
    workoutMonths: 20,
    remittances: [],
    ...over,
  };
}

describe("expectedFraction", () => {
  it("is 0 at month 0 and 1 at the end of the workout", () => {
    expect(expectedFraction(0, 12)).toBeCloseTo(0, 6);
    expect(expectedFraction(12, 12)).toBeCloseTo(1, 6);
  });

  it("is front-loaded — past the halfway month, more than half is expected", () => {
    const half = expectedFraction(6, 12);
    expect(half).toBeGreaterThan(0.5);
    expect(half).toBeCloseTo(1 - Math.pow(0.5, 1.6), 6);
  });

  it("clamps elapsed beyond the workout window to full recovery", () => {
    expect(expectedFraction(40, 20)).toBeCloseTo(1, 6);
  });

  it("returns full recovery when workoutMonths is non-positive", () => {
    expect(expectedFraction(5, 0)).toBe(1);
  });
});

describe("totalCollected", () => {
  it("sums remittances and ignores non-numeric amounts", () => {
    const hc = holding({
      remittances: [
        { id: "a", month: "2026-01", amountUsd: 1000 },
        { id: "b", month: "2026-02", amountUsd: 500 },
        // @ts-expect-error — exercising the runtime guard against bad data
        { id: "c", month: "2026-03", amountUsd: "oops" },
      ],
    });
    expect(totalCollected(hc)).toBe(1500);
  });
});

describe("recoveryStatus", () => {
  // face 1,000,000 × 20% = 200,000 lifetime; 10/20 months → fraction ≈ 0.6701
  // expectedNow ≈ 134,019
  const face = 1_000_000;
  const months = 10;

  it("labels a big overcollection as ahead", () => {
    const hc = holding({
      remittances: [{ id: "a", month: "2026-01", amountUsd: 200_000 }],
    });
    const s = recoveryStatus(hc, face, months);
    expect(s.label).toBe("ahead");
    expect(s.deltaPct).toBeGreaterThan(10);
  });

  it("labels a big undercollection as behind", () => {
    const hc = holding({
      remittances: [{ id: "a", month: "2026-01", amountUsd: 50_000 }],
    });
    const s = recoveryStatus(hc, face, months);
    expect(s.label).toBe("behind");
    expect(s.deltaPct).toBeLessThan(-10);
  });

  it("labels collections near the model as on-track", () => {
    const expectedNow = 200_000 * expectedFraction(months, 20);
    const hc = holding({
      remittances: [
        { id: "a", month: "2026-01", amountUsd: Math.round(expectedNow) },
      ],
    });
    const s = recoveryStatus(hc, face, months);
    expect(s.label).toBe("on-track");
    expect(Math.abs(s.deltaPct)).toBeLessThanOrEqual(10);
  });

  it("computes lifetime expected from face × recovery%", () => {
    const s = recoveryStatus(holding(), face, months);
    expect(s.lifetimeExpectedUsd).toBe(200_000);
  });
});
