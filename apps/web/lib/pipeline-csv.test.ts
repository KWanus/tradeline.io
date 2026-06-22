import { describe, expect, it } from "vitest";
import { PIPELINE_TEMPLATE_CSV, parsePipelineCsv } from "./pipeline-csv";

describe("parsePipelineCsv", () => {
  it("parses the bundled template into well-formed rows", () => {
    const { rows, errors } = parsePipelineCsv(PIPELINE_TEMPLATE_CSV);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      ticker: "FCNCA",
      brokerName: "Cavalry",
      assetClass: "credit card",
      faceValueUsd: 4_200_000,
      askCentsPerDollar: 8.5,
      bidCentsPerDollar: 7.2,
      stage: "reviewing",
    });
    // Empty bid cell → undefined, not 0
    expect(rows[1].bidCentsPerDollar).toBeUndefined();
  });

  it("matches columns via header aliases regardless of order", () => {
    const csv =
      "Status,Bank,Amount,Seller,Class\n" +
      'bidding,WAL,"$1,500,000",Garnet,auto';
    const { rows } = parsePipelineCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ticker: "WAL",
      brokerName: "Garnet",
      assetClass: "auto",
      faceValueUsd: 1_500_000,
      stage: "bidding",
    });
  });

  it("strips $ and commas from money and normalizes unknown stages", () => {
    const csv = "ticker,broker,face value,stage\nABC,Acme,\"$2,100,000\",weird";
    const { rows } = parsePipelineCsv(csv);
    expect(rows[0].faceValueUsd).toBe(2_100_000);
    expect(rows[0].stage).toBe("sourced");
  });

  it("reports a per-row error for a non-numeric face value and skips it", () => {
    const csv = "ticker,broker,face value\nABC,Acme,not-a-number";
    const { rows, errors } = parsePipelineCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/face value/i);
  });

  it("errors clearly when no recognizable columns are present", () => {
    const { rows, errors } = parsePipelineCsv("foo,bar\n1,2");
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/ticker|broker/i);
  });

  it("returns an empty result for empty input", () => {
    expect(parsePipelineCsv("   ")).toEqual({ rows: [], errors: ["Empty file."] });
  });
});
