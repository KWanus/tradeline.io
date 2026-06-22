import { beforeEach, describe, expect, it } from "vitest";
import { CAPITAL_KEY, readCapitalState } from "./capital";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";
const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

describe("readCapitalState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reports unconfigured when no total is set", () => {
    const s = readCapitalState();
    expect(s.configured).toBe(false);
    expect(s.total).toBe(0);
  });

  it("nets deployed and committed capital off the total", () => {
    window.localStorage.setItem(
      CAPITAL_KEY,
      JSON.stringify({ totalCapitalUsd: 100_000 })
    );
    window.localStorage.setItem(
      PORTFOLIO_KEY,
      JSON.stringify([{ purchasePriceUsd: 20_000 }, { purchasePriceUsd: 5_000 }])
    );
    window.localStorage.setItem(
      PIPELINE_KEY,
      JSON.stringify([
        // committed: live bid = 100,000 × 10¢ = 10,000
        { faceValueUsd: 100_000, bidCentsPerDollar: 10, stage: "bidding" },
        // not bidding → does not commit capital
        { faceValueUsd: 999_999, bidCentsPerDollar: 50, stage: "sourced" },
      ])
    );

    const s = readCapitalState();
    expect(s.configured).toBe(true);
    expect(s.total).toBe(100_000);
    expect(s.deployed).toBe(25_000);
    expect(s.committed).toBe(10_000);
    expect(s.available).toBe(65_000);
  });

  it("can go negative when over-committed (the warning condition)", () => {
    window.localStorage.setItem(
      CAPITAL_KEY,
      JSON.stringify({ totalCapitalUsd: 10_000 })
    );
    window.localStorage.setItem(
      PIPELINE_KEY,
      JSON.stringify([
        { faceValueUsd: 1_000_000, bidCentsPerDollar: 5, stage: "bidding" },
      ])
    );
    const s = readCapitalState();
    expect(s.committed).toBe(50_000);
    expect(s.available).toBeLessThan(0);
  });
});
