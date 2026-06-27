import { describe, expect, it } from "vitest";

import {
  AREA_CODE_STATE,
  STATE_NAMES,
  areaCodeFromPhone,
  stateForAreaCode,
  statesForAreaCodes,
} from "./area-codes";

describe("stateForAreaCode", () => {
  it("maps known codes to states", () => {
    expect(stateForAreaCode("602")).toBe("AZ");
    expect(stateForAreaCode("212")).toBe("NY");
    expect(stateForAreaCode("415")).toBe("CA");
    expect(stateForAreaCode("214")).toBe("TX");
  });
  it("tolerates formatting and extra digits", () => {
    expect(stateForAreaCode("(602)")).toBe("AZ");
    expect(stateForAreaCode("602555")).toBe("AZ");
  });
  it("returns undefined for unknown/non-geographic codes", () => {
    expect(stateForAreaCode("800")).toBeUndefined();
    expect(stateForAreaCode("000")).toBeUndefined();
  });
});

describe("areaCodeFromPhone", () => {
  it("extracts the area code from formatted numbers", () => {
    expect(areaCodeFromPhone("+1 (602) 555-0148")).toBe("602");
    expect(areaCodeFromPhone("602-555-0148")).toBe("602");
    expect(areaCodeFromPhone("6025550148")).toBe("602");
  });
  it("strips a leading US country code", () => {
    expect(areaCodeFromPhone("12125550148")).toBe("212");
  });
  it("returns undefined when too short", () => {
    expect(areaCodeFromPhone("55")).toBeUndefined();
  });
});

describe("statesForAreaCodes", () => {
  it("dedupes and drops unknowns", () => {
    const out = statesForAreaCodes(["602", "480", "212", "000"]);
    expect(out.sort()).toEqual(["AZ", "NY"]);
  });
});

describe("data integrity", () => {
  it("every mapped state has a name", () => {
    for (const st of Object.values(AREA_CODE_STATE)) {
      expect(STATE_NAMES[st], `missing name for ${st}`).toBeTruthy();
    }
  });
  it("keys are all 3-digit codes", () => {
    for (const code of Object.keys(AREA_CODE_STATE)) {
      expect(code).toMatch(/^\d{3}$/);
    }
  });
});
