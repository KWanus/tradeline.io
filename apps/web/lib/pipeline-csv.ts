/**
 * Pipeline CSV import parsing. Operators live in spreadsheets — this lets them
 * paste or upload their existing deal tracker and have it land in the pipeline
 * board with no re-keying. The parser is forgiving about header naming and
 * column order (it matches on normalized header aliases), and reports per-row
 * errors so the import preview can show exactly what would be skipped.
 *
 * Shared contract with <CsvImportPanel<T>>: `parse(text) => CsvParseResult<T>`.
 */

export type CsvParseResult<T> = {
  rows: T[];
  errors: string[];
};

/** Mirrors the pipeline board's Stage union so parsed rows spread straight
 *  into a Deal without a cast. */
export type PipelineStage =
  | "sourced"
  | "reviewing"
  | "underwriting"
  | "bidding"
  | "won"
  | "lost"
  | "walked";

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

const VALID_STAGES: readonly PipelineStage[] = [
  "sourced",
  "reviewing",
  "underwriting",
  "bidding",
  "won",
  "lost",
  "walked",
];

export const PIPELINE_TEMPLATE_CSV =
  "ticker,broker,asset class,face value,ask,bid,stage,notes\n" +
  "FCNCA,Cavalry,credit card,4200000,8.5,7.2,reviewing,Met seller at NCBA\n" +
  "WAL,Garnet,auto,1500000,11,,sourced,Intro from broker\n";

/** Header aliases → canonical field. Compared after lower-casing + stripping
 *  non-alphanumerics, so "Face Value ($)" and "face_value" both match. */
const HEADER_ALIASES: Record<string, keyof ParsedDealRow> = {
  ticker: "ticker",
  symbol: "ticker",
  bank: "ticker",
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
  askcentsperdollar: "askCentsPerDollar",
  bid: "bidCentsPerDollar",
  bidcents: "bidCentsPerDollar",
  bidcentsperdollar: "bidCentsPerDollar",
  stage: "stage",
  status: "stage",
  notes: "notes",
  note: "notes",
  comment: "notes",
  comments: "notes",
};

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Split a single CSV line, honoring double-quoted fields with embedded commas
 *  and escaped quotes ("") — enough for spreadsheet exports without a dep. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseRate(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw.replace(/[%\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function normStage(raw: string): PipelineStage {
  const s = raw.toLowerCase().trim() as PipelineStage;
  return VALID_STAGES.includes(s) ? s : "sourced";
}

export function parsePipelineCsv(text: string): CsvParseResult<ParsedDealRow> {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ["Empty file."] };
  }

  const headerCells = splitCsvLine(lines[0]).map(normHeader);
  const colMap: Partial<Record<keyof ParsedDealRow, number>> = {};
  headerCells.forEach((h, i) => {
    const field = HEADER_ALIASES[h];
    if (field && colMap[field] === undefined) colMap[field] = i;
  });

  if (colMap.ticker === undefined && colMap.brokerName === undefined) {
    return {
      rows: [],
      errors: [
        "Couldn't find a 'ticker' or 'broker' column. Check the header row against the template.",
      ],
    };
  }

  const rows: ParsedDealRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (f: keyof ParsedDealRow): string => {
      const idx = colMap[f];
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };

    const ticker = get("ticker").toUpperCase();
    const brokerName = get("brokerName");
    if (!ticker && !brokerName) {
      // Blank-ish row — skip silently rather than erroring.
      continue;
    }

    const faceRaw = get("faceValueUsd");
    const faceValueUsd = faceRaw ? parseMoney(faceRaw) : 0;
    if (faceRaw && Number.isNaN(faceValueUsd)) {
      errors.push(`Row ${i + 1}: face value "${faceRaw}" isn't a number — skipped.`);
      continue;
    }

    rows.push({
      ticker,
      brokerName,
      assetClass: get("assetClass") || "unspecified",
      faceValueUsd: Number.isNaN(faceValueUsd) ? 0 : faceValueUsd,
      askCentsPerDollar: parseRate(get("askCentsPerDollar")),
      bidCentsPerDollar: parseRate(get("bidCentsPerDollar")),
      stage: normStage(get("stage")),
      notes: get("notes"),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No data rows found beneath the header.");
  }

  return { rows, errors };
}
