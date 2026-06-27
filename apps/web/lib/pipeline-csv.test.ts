import { describe, expect, it } from "vitest";

import { PIPELINE_TEMPLATE_CSV, parsePipelineCsv } from "./pipeline-csv";

describe("parsePipelineCsv", () => {
  it("parses the template into rows", () => {
    const rows = parsePipelineCsv(PIPELINE_TEMPLATE_CSV);
    expect(rows.length).toBe(3);
    expect(rows[0].ticker).toBe("WAL");
    expect(rows[0].brokerName).toBe("Garnet Capital");
    expect(rows[0].faceValueUsd).toBe(12_000_000);
    expect(rows[0].stage).toBe("reviewing");
  });

  it("coerces money strings", () => {
    const csv =
      "ticker,broker,asset class,face value,ask,bid,stage,notes\n" +
      "AAA,BrokerCo,auto,$4.2M,,,sourced,note\n" +
      "BBB,BrokerCo,auto,850k,,,sourced,note\n" +
      "CCC,BrokerCo,auto,\"1,250,000\",,,sourced,note";
    const rows = parsePipelineCsv(csv);
    expect(rows[0].faceValueUsd).toBe(4_200_000);
    expect(rows[1].faceValueUsd).toBe(850_000);
    expect(rows[2].faceValueUsd).toBe(1_250_000);
  });

  it("snaps free-text stages onto canonical stages", () => {
    const csv =
      "ticker,broker,asset class,face value,ask,bid,stage,notes\n" +
      "AAA,BrokerCo,auto,1000,,,Due Diligence,n\n" +
      "BBB,BrokerCo,auto,1000,,,gibberish,n";
    const rows = parsePipelineCsv(csv);
    expect(rows[0].stage).toBe("reviewing");
    expect(rows[1].stage).toBe("sourced");
  });

  it("returns [] when there's no recognizable header", () => {
    expect(parsePipelineCsv("just,some,random,values\n1,2,3,4")).toEqual([]);
    expect(parsePipelineCsv("")).toEqual([]);
  });

  it("skips rows with neither ticker nor broker", () => {
    const csv =
      "ticker,broker,asset class,face value,ask,bid,stage,notes\n" +
      ",,auto,1000,,,sourced,n\n" +
      "AAA,,auto,1000,,,sourced,n";
    const rows = parsePipelineCsv(csv);
    expect(rows.length).toBe(1);
    expect(rows[0].ticker).toBe("AAA");
  });
});
