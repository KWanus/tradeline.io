// CSV/TSV parser for buyer-book import. Intentionally minimal — handles the
// shapes brokers actually paste (Google Sheets, Excel exports, plain CSV)
// without pulling in a parser dependency. Quoted fields with embedded commas
// are supported; embedded newlines inside quoted fields are not (brokers
// don't put paragraphs in spreadsheet cells).

import type { Buyer } from "./buyer-book";

// Friendly aliases the importer accepts for each canonical field. All
// matching is case-insensitive and ignores spaces / underscores so
// "Firm Name", "firm_name", "company", "Buyer" all map to firm.
const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  firm: ["firm", "firm name", "company", "company name", "buyer", "buyer firm"],
  contactName: [
    "contact",
    "contact name",
    "name",
    "person",
    "primary contact",
  ],
  email: ["email", "e-mail", "email address", "contact email"],
  licensedStates: [
    "licensed states",
    "states",
    "state",
    "licensed in",
    "licensure",
  ],
  assetClasses: [
    "asset classes",
    "asset class",
    "buys",
    "asset focus",
    "products",
  ],
  ticketMinUsd: [
    "ticket min",
    "ticket min usd",
    "min ticket",
    "min",
    "ticket floor",
  ],
  ticketMaxUsd: [
    "ticket max",
    "ticket max usd",
    "max ticket",
    "max",
    "ticket ceiling",
  ],
  notes: ["notes", "comments", "memo", "description"],
};

type ParsedRow = {
  firm: string;
  contactName: string;
  email: string;
  licensedStates: string[];
  assetClasses: string[];
  ticketMinUsd: number;
  ticketMaxUsd: number;
  notes: string;
};

export type ImportResult = {
  rows: ParsedRow[];
  // Headers we successfully mapped to canonical fields, in source order.
  mappedHeaders: Array<{ source: string; field: keyof ParsedRow }>;
  // Headers in the source that we couldn't map. Surfaced as a warning so
  // the broker knows their "tier" or "last touched" column was ignored.
  unmappedHeaders: string[];
  // Total source rows (after the header) — useful to report when some rows
  // were dropped because the firm column was blank.
  totalRows: number;
};

function normHeader(s: string): string {
  return s.toLowerCase().trim().replace(/[_\s]+/g, " ");
}

function detectDelimiter(text: string): "," | "\t" {
  // First non-empty line decides. Tabs win when there are more tabs than
  // commas — that handles Excel/Sheets "copy as table" which is TSV.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  // Minimal quote-aware splitter. "" inside a quoted field unescapes to ".
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
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseList(raw: string): string[] {
  if (!raw) return [];
  // Accept commas, semicolons, or pipes as the inner separator so brokers
  // don't have to wrap "NC, VA, SC" in quotes — they can write "NC;VA;SC"
  // or "NC|VA|SC" and the outer CSV stays clean.
  return raw
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMoney(raw: string): number {
  if (!raw) return 0;
  // Strip $, commas, whitespace; "k"/"m" suffix multiplies. So "$1.5M",
  // "1,500,000", "1500k" all yield 1500000.
  const cleaned = raw.toLowerCase().replace(/[$,\s]/g, "");
  const m = cleaned.match(/^([\d.]+)([km])?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  if (m[2] === "k") return Math.round(n * 1_000);
  if (m[2] === "m") return Math.round(n * 1_000_000);
  return Math.round(n);
}

export function parseBuyerCsv(text: string): ImportResult {
  const delim = detectDelimiter(text);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/﻿/g, "")) // strip BOM if present
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], mappedHeaders: [], unmappedHeaders: [], totalRows: 0 };
  }

  const headerCells = splitCsvLine(lines[0], delim);
  const mappedHeaders: Array<{ source: string; field: keyof ParsedRow }> = [];
  const unmappedHeaders: string[] = [];
  const fieldByIndex: Array<keyof ParsedRow | null> = headerCells.map((h) => {
    const norm = normHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
      [keyof ParsedRow, string[]]
    >) {
      if (aliases.includes(norm)) {
        mappedHeaders.push({ source: h, field });
        return field;
      }
    }
    unmappedHeaders.push(h);
    return null;
  });

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    const row: ParsedRow = {
      firm: "",
      contactName: "",
      email: "",
      licensedStates: [],
      assetClasses: [],
      ticketMinUsd: 0,
      ticketMaxUsd: 0,
      notes: "",
    };
    cells.forEach((cell, idx) => {
      const field = fieldByIndex[idx];
      if (!field) return;
      const value = cell.trim();
      switch (field) {
        case "firm":
        case "contactName":
        case "email":
        case "notes":
          row[field] = value;
          break;
        case "licensedStates":
          row.licensedStates = parseList(value).map((s) => s.toUpperCase());
          break;
        case "assetClasses":
          row.assetClasses = parseList(value);
          break;
        case "ticketMinUsd":
          row.ticketMinUsd = parseMoney(value);
          break;
        case "ticketMaxUsd":
          row.ticketMaxUsd = parseMoney(value);
          break;
      }
    });
    // Drop rows with no firm — they're either blank lines or malformed
    // (e.g. a "total" row pasted from the bottom of a spreadsheet).
    if (row.firm) rows.push(row);
  }

  return {
    rows,
    mappedHeaders,
    unmappedHeaders,
    totalRows: lines.length - 1,
  };
}

export function toBuyerInput(
  row: ParsedRow
): Omit<Buyer, "id" | "addedAt"> {
  return {
    firm: row.firm,
    contactName: row.contactName,
    email: row.email,
    licensedStates: row.licensedStates,
    assetClasses: row.assetClasses,
    ticketMinUsd: row.ticketMinUsd,
    ticketMaxUsd: row.ticketMaxUsd,
    lastDealAt: undefined,
    notes: row.notes,
  };
}

// Downloadable template the user can open in Excel/Sheets, fill in, paste
// back. Header names match the canonical aliases above so a round-trip is
// always lossless.
export const TEMPLATE_CSV = [
  "firm,contact name,email,licensed states,asset classes,ticket min usd,ticket max usd,notes",
  'Cavalry SPV I, LLC,Sarah Lee,sarah@cavalry.com,NC;VA;SC,consumer credit card;auto deficiency,250000,5000000,Met at NCBA conf',
  'Crown Asset Management,,intake@crown.com,GA;FL;NC,consumer credit card,50000,2000000,Southeast focus',
].join("\n");
