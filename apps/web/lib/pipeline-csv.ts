/**
 * CSV import for the pipeline board. Operators keep deal pipelines in
 * spreadsheets; this parses a pasted/uploaded CSV into deal rows the board can
 * commit straight to localStorage.
 *
 * Tolerant by design: column order follows the template header but we match
 * headers by name (case-insensitive, aliases allowed), coerce money strings
 * ("$4.2M", "4,200,000", "850k"), and snap free-text stages onto the canonical
 * pipeline stages. Unparseable rows are dropped rather than throwing.
 */

export type PipelineStage =
  | "sourced"
  | "reviewing"
  | "underwriting"
  | "bidding"
  | "won"
  | "lost"
  | "walked";

/** A parsed row — shape matches the board's Deal minus the generated fields. */
export type ParsedDealRow = {
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  askCentsPerDollar?: number;
  bidCentsPerDollar?: number;
  stage: PipelineStage;
  notes: string;
};

export const PIPELINE_TEMPLATE_CSV = `ticker,broker,asset class,face value,ask,bid,stage,notes
WAL,Garnet Capital,credit card,12000000,5.5,,reviewing,Fresh tape full docs
FLG,RMG Investments,junior mortgage,28500000,42,38,bidding,Secured paper 60% LTV
,Cavalry,auto,4200000,8.5,7.2,sourced,Met seller at conference
`;

const STAGES: PipelineStage[] = [
  "sourced",
  "reviewing",
  "underwriting",
  "bidding",
  "won",
  "lost",
  "walked",
];

// Header aliases → canonical field. Lower-cased, punctuation-stripped on match.
const HEADER_ALIASES: Record<string, keyof ParsedDealRow> = {
  ticker: "ticker",
  symbol: "ticker",
  originator: "ticker",
  broker: "brokerName",
  brokername: "brokerName",
  seller: "brokerName",
  asset: "assetClass",
  assetclass: "assetClass",
  class: "assetClass",
  face: "faceValueUsd",
  facevalue: "faceValueUsd",
  facevalueusd: "faceValueUsd",
  amount: "faceValueUsd",
  ask: "askCentsPerDollar",
  askcents: "askCentsPerDollar",
  bid: "bidCentsPerDollar",
  bidcents: "bidCentsPerDollar",
  stage: "stage",
  status: "stage",
  notes: "notes",
  note: "notes",
  comment: "notes",
};

function normHeader(h: string): keyof ParsedDealRow | null {
  const key = h.trim().toLowerCase().replace(/[^a-z]/g, "");
  return HEADER_ALIASES[key] ?? null;
}

function coerceMoney(raw: string): number {
  if (!raw) return 0;
  const s = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!s) return 0;
  const mult = s.endsWith("m") ? 1_000_000 : s.endsWith("k") ? 1_000 : 1;
  const num = parseFloat(mult === 1 ? s : s.slice(0, -1));
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * mult);
}

function coerceCents(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = parseFloat(raw.trim().replace(/[¢$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function coerceStage(raw: string): PipelineStage {
  const s = raw.trim().toLowerCase();
  const hit = STAGES.find((st) => st === s);
  if (hit) return hit;
  // Loose synonyms.
  if (/(new|lead|source)/.test(s)) return "sourced";
  if (/(review|diligence|dd)/.test(s)) return "reviewing";
  if (/(under|uw|model)/.test(s)) return "underwriting";
  if (/(bid|offer)/.test(s)) return "bidding";
  if (/(won|closed|bought)/.test(s)) return "won";
  if (/(lost|dead)/.test(s)) return "lost";
  if (/(walk|pass)/.test(s)) return "walked";
  return "sourced";
}

/** Split one CSV line, honoring double-quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parsePipelineCsv(text: string): ParsedDealRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // First non-empty line is the header.
  const headerCells = splitCsvLine(lines[0]);
  const cols = headerCells.map(normHeader);
  // If the header didn't map to anything sensible, bail (operator pasted data
  // without a header row — we can't trust positional mapping).
  if (!cols.some((c) => c === "ticker" || c === "brokerName")) return [];

  const rows: ParsedDealRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const rec: Record<string, string> = {};
    cols.forEach((field, i) => {
      if (field) rec[field] = cells[i] ?? "";
    });

    const ticker = (rec.ticker || "").toUpperCase();
    const brokerName = rec.brokerName || "";
    // Skip rows with neither an originator nor a broker — nothing to identify.
    if (!ticker && !brokerName) continue;

    rows.push({
      ticker,
      brokerName: brokerName || "—",
      assetClass: rec.assetClass || "—",
      faceValueUsd: coerceMoney(rec.faceValueUsd || ""),
      askCentsPerDollar: coerceCents(rec.askCentsPerDollar || ""),
      bidCentsPerDollar: coerceCents(rec.bidCentsPerDollar || ""),
      stage: coerceStage(rec.stage || ""),
      notes: rec.notes || "",
    });
  }
  return rows;
}
