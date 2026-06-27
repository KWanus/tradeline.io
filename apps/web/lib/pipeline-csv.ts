/**
 * Pipeline CSV import. Parses a pasted/uploaded deal sheet into typed rows the
 * pipeline board can commit. Tolerant: skips a header row, ignores blanks,
 * parses currency/number-ish fields loosely.
 */

export type DealStage =
  | "sourced" | "reviewing" | "underwriting" | "bidding" | "won" | "lost" | "walked";

// Field names mirror the pipeline board's `Deal` so a parsed row spreads
// straight into a new deal.
export type ParsedDealRow = {
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  askCentsPerDollar?: number;
  bidCentsPerDollar?: number;
  stage: DealStage;
  notes: string;
};

export const PIPELINE_TEMPLATE_CSV =
  "ticker,broker,asset class,face value,ask,bid,stage,notes\n" +
  "FCNCA,Cavalry,credit card,4200000,8.5,7.2,reviewing,Met seller at NCBA\n";

const VALID_STAGES: DealStage[] = [
  "sourced", "reviewing", "underwriting", "bidding", "won", "lost", "walked",
];

function toStage(s: string): DealStage {
  const v = s.toLowerCase() as DealStage;
  return VALID_STAGES.includes(v) ? v : "sourced";
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[$,%\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function splitLine(line: string): string[] {
  // Minimal CSV: handles quoted fields with commas.
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parsePipelineCsv(text: string): ParsedDealRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  // Drop a header row if the first line looks like column names.
  const first = lines[0].toLowerCase();
  const start = first.includes("ticker") && first.includes("stage") ? 1 : 0;

  const rows: ParsedDealRow[] = [];
  for (const line of lines.slice(start)) {
    const c = splitLine(line);
    if (c.length < 2) continue;
    rows.push({
      ticker: (c[0] || "").toUpperCase(),
      brokerName: c[1] || "",
      assetClass: c[2] || "",
      faceValueUsd: num(c[3]) ?? 0,
      askCentsPerDollar: num(c[4]) ?? undefined,
      bidCentsPerDollar: num(c[5]) ?? undefined,
      stage: toStage(c[6] || "sourced"),
      notes: c[7] || "",
    });
  }
  return rows;
}
