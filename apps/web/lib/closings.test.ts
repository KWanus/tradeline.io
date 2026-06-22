import { describe, expect, it } from "vitest";
import {
  CLOSING_STEPS,
  closingFor,
  completedCount,
  emptyClosing,
  isClosed,
} from "./closings";

describe("emptyClosing", () => {
  it("starts every checklist step false and unclosed", () => {
    const c = emptyClosing("deal-1");
    expect(completedCount(c)).toBe(0);
    expect(isClosed(c)).toBe(false);
    expect(c.buybacks).toEqual([]);
  });
});

describe("completedCount / isClosed", () => {
  it("counts only the checked steps", () => {
    const c = emptyClosing("deal-1");
    c.checklist.contractExecuted = true;
    c.checklist.wireSent = true;
    expect(completedCount(c)).toBe(2);
    expect(isClosed(c)).toBe(false);
  });

  it("is closed only when every step is checked", () => {
    const c = emptyClosing("deal-1");
    for (const step of CLOSING_STEPS) c.checklist[step.key] = true;
    expect(completedCount(c)).toBe(CLOSING_STEPS.length);
    expect(isClosed(c)).toBe(true);
  });
});

describe("closingFor", () => {
  it("returns the matching closing when present", () => {
    const existing = emptyClosing("deal-1");
    existing.wireInstructions = "ABA 123";
    expect(closingFor("deal-1", [existing])).toBe(existing);
  });

  it("returns a fresh empty closing when absent", () => {
    const c = closingFor("missing", []);
    expect(c.dealId).toBe("missing");
    expect(isClosed(c)).toBe(false);
  });
});
