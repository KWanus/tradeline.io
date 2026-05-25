// Tape-vs-media chain-of-custody reconciliation.
//
// THE killer differentiator. Operator drops the seller's media zip alongside
// the tape. We parse the zip in-browser (filenames only — we don't read
// PDF contents for V1), match each filename to a tape row by account number,
// classify each doc by category (bill of sale / assignment / application /
// statements / itemization / affidavit / etc.), and grade each account's
// chain-of-custody completeness.
//
// Output: "enforceable face value" — the slice of the tape that has the
// minimum documentation to survive a courtroom challenge. This is almost
// always materially lower than the seller's quoted face value, and the
// delta is what the buyer should subtract from their bid.
//
// Reference for the rules:
//   - Hartman methodology: account value = $0 if chain has a gap
//   - Reg F §1006.34: itemization-date requirement
//   - State evidence rules: bill of sale from each prior holder, plus
//     origination docs (signed application / cardholder agreement /
//     statement history)
//   - Defense bar standard demand: full chain back to original creditor
//
// Privacy posture: the zip is parsed in the browser, never uploaded. We
// store ONLY filenames + sizes + doc category — no PDF contents are
// extracted or kept. Match is by account-number substring on the filename.

import { unzip, type Unzipped } from "fflate";
import { parseCsv } from "./tape-analyzer";
import { detectCanonicalFields } from "./tape-canonical-schema";

// ---------------------------------------------------------------------------
// Doc categories
// ---------------------------------------------------------------------------

export type DocCategory =
  | "bill_of_sale"
  | "assignment"
  | "affidavit_of_debt"
  | "custodian_affidavit"
  | "application"
  | "card_agreement"
  | "statement_history"
  | "itemization"
  | "payment_history"
  | "settlement_letter"
  | "media_inventory"
  | "other";

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  bill_of_sale: "Bill of sale",
  assignment: "Assignment / allonge",
  affidavit_of_debt: "Affidavit of debt",
  custodian_affidavit: "Custodian-of-records affidavit",
  application: "Signed application",
  card_agreement: "Cardholder agreement / T&C",
  statement_history: "Statement history",
  itemization: "Itemization (Reg F)",
  payment_history: "Payment history",
  settlement_letter: "Settlement letter",
  media_inventory: "Media inventory / manifest",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Classifier — filename → category
//
// Filenames in real media zips follow conventions like:
//   <acct#>_BOS.pdf
//   123456789_assignment_2018-03-12.pdf
//   1234_xxxx_xxxx_5678_card_agreement.pdf
//   account_5555/statement_2019_Q4.pdf
//   AOD_signed_5555.pdf
//   doc/<acct#>/<filename>.pdf
// We classify on the LAST path segment (basename), normalized.
// ---------------------------------------------------------------------------

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

export function classifyDoc(filename: string): DocCategory {
  const name = basename(filename).toLowerCase();
  if (/\b(bos|bill.?of.?sale|sale.?agreement|purchase.?agreement)\b/.test(name))
    return "bill_of_sale";
  if (/\b(assignment|allonge|assign)\b/.test(name)) return "assignment";
  if (/\b(affidavit.?of.?debt|aod)\b/.test(name)) return "affidavit_of_debt";
  if (/\b(custodian|cor[._]|c[._-]of[._-]r)\b/.test(name)) return "custodian_affidavit";
  if (/\b(application|signed.?app|app[._-]signed|cust.?app)\b/.test(name)) return "application";
  if (/\b(agreement|terms|t[._&-]c|cardholder|tcs?)\b/.test(name)) return "card_agreement";
  if (/\b(statement|stmt|bill[._-])\b/.test(name)) return "statement_history";
  if (/\b(itemization|itemized)\b/.test(name)) return "itemization";
  if (/\b(payment.?history|pmt.?hist|payhist)\b/.test(name)) return "payment_history";
  if (/\b(settlement|settled.?in.?full)\b/.test(name)) return "settlement_letter";
  if (/\b(media.?inventory|inventory|manifest|index)\b/.test(name)) return "media_inventory";
  return "other";
}

// ---------------------------------------------------------------------------
// Account-key matching
//
// Strategies (highest specificity first):
//   1. Full account-number substring in filename
//   2. Last-4 substring in filename (when account is > 4 chars)
//   3. (Future) seller-account-number, joint match with last-name token
// ---------------------------------------------------------------------------

export function matchFilenameToAccount(
  filename: string,
  accountKeysSorted: string[] // pre-sorted longest-first
): string | null {
  const name = basename(filename).toLowerCase().replace(/[^a-z0-9]+/g, "");
  // Pass 1: full account-number substring
  for (const key of accountKeysSorted) {
    if (key.length < 4) continue;
    const normKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (normKey.length >= 4 && name.includes(normKey)) {
      return key;
    }
  }
  // Pass 2: last-4 substring (account-number tail). Only when last-4
  // appears in a digit-context to avoid coincidental matches.
  for (const key of accountKeysSorted) {
    if (key.length <= 4) continue;
    const last4 = key.slice(-4).toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (last4.length < 4) continue;
    // Require last-4 to appear adjacent to or surrounded by digits — avoids
    // accidental matches like "2024" in a year.
    const re = new RegExp(`(^|\\D)${last4}(\\D|$)`);
    if (re.test(basename(filename).toLowerCase())) {
      return key;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-account doc record + enforceability scoring
// ---------------------------------------------------------------------------

export type DocFile = {
  filename: string;
  sizeBytes: number;
  category: DocCategory;
};

export type AccountDocs = {
  accountKey: string;
  rowIndex: number; // 0-based row in original tape (1-based for display)
  faceValue: number;
  docs: DocFile[];
  // Doc-presence flags
  hasBillOfSale: boolean;
  hasAssignment: boolean;
  hasOriginationDocs: boolean;
  hasItemization: boolean;
  // 0-100 score with status bucket
  enforceabilityScore: number;
  enforceabilityStatus: "green" | "yellow" | "red";
};

// Required-doc minimums per Hartman / state evidence rules:
//   - bill_of_sale (or affidavit_of_debt as alternative)
//   - origination doc (application / card_agreement / statement_history)
//   - itemization (Reg F satisfies; statement_history typically provides it)
// Each contributes to score; status is green only when all 3 present.
export function scoreAccountEnforceability(docs: DocFile[]): {
  score: number;
  status: "green" | "yellow" | "red";
  hasBillOfSale: boolean;
  hasAssignment: boolean;
  hasOriginationDocs: boolean;
  hasItemization: boolean;
} {
  const cats = new Set(docs.map((d) => d.category));
  const hasBillOfSale = cats.has("bill_of_sale") || cats.has("affidavit_of_debt");
  const hasAssignment = cats.has("assignment");
  const hasOriginationDocs =
    cats.has("application") || cats.has("card_agreement") || cats.has("statement_history");
  const hasItemization = cats.has("itemization") || cats.has("statement_history");

  let score = 0;
  if (hasBillOfSale) score += 35;
  if (hasOriginationDocs) score += 35;
  if (hasItemization) score += 15;
  if (hasAssignment) score += 15;

  let status: "green" | "yellow" | "red";
  if (hasBillOfSale && hasOriginationDocs && hasItemization) status = "green";
  else if (hasBillOfSale || hasOriginationDocs) status = "yellow";
  else status = "red";

  return {
    score,
    status,
    hasBillOfSale,
    hasAssignment,
    hasOriginationDocs,
    hasItemization,
  };
}

// ---------------------------------------------------------------------------
// Tape-level report
// ---------------------------------------------------------------------------

export type ChainOfCustodyReport = {
  // Zip-level stats
  totalFilesInZip: number;
  totalBytesInZip: number;
  matchedFiles: number;
  unmatchedFiles: number;
  byDocCategory: Record<DocCategory, { count: number; bytes: number }>;
  // List of unmatched filenames (capped for UX)
  unmatchedExamples: string[];

  // Per-account results
  perAccount: AccountDocs[];
  totalAccountsOnTape: number;

  // Headline numbers
  totalFaceAnalyzed: number;
  enforceableFaceValue: number; // sum of face for green
  partialFaceValue: number; // yellow
  uncollectableFaceValue: number; // red (no docs at all)
  accountsWithNoDocs: number;

  // Per-category completeness
  accountsWithBillOfSale: number;
  accountsWithAssignment: number;
  accountsWithOriginationDocs: number;
  accountsWithItemization: number;
};

// ---------------------------------------------------------------------------
// Zip parsing — list filenames + sizes only
// ---------------------------------------------------------------------------

export type ZipEntry = { filename: string; sizeBytes: number };

export async function listZipEntries(zipBytes: Uint8Array): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    unzip(zipBytes, (err: Error | null, files: Unzipped | undefined) => {
      if (err) return reject(err);
      if (!files) return resolve([]);
      const out: ZipEntry[] = [];
      for (const [filename, contents] of Object.entries(files)) {
        // Skip directory entries (fflate emits zero-byte entries for dirs
        // ending in /)
        if (filename.endsWith("/")) continue;
        out.push({ filename, sizeBytes: contents.length });
      }
      resolve(out);
    });
  });
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

export type TapeAccountInput = {
  accountKey: string; // original account number (PII — never leaves browser)
  rowIndex: number;
  faceValue: number;
};

// Extract per-row account inputs from a raw CSV. Used by the chain-of-
// custody analyzer when an operator drops the media zip — the analyzer
// already discarded row data, so we re-parse here. The result lives in
// browser memory ONLY for the duration of the reconciliation; nothing
// is persisted or sent anywhere.
export function extractTapeAccountInputs(csvText: string): {
  accounts: TapeAccountInput[];
  accountNumberHeader: string | null;
  balanceHeader: string | null;
  totalAccountsOnTape: number;
} {
  const { headers, records } = parseCsv(csvText);
  const schema = detectCanonicalFields(headers);
  const acctHeader = schema.byCanonical.get("original_account_number")?.header ?? null;
  const balHeader =
    schema.byCanonical.get("account_balance")?.header ??
    schema.byCanonical.get("charge_off_balance")?.header ??
    null;
  if (!acctHeader) {
    return {
      accounts: [],
      accountNumberHeader: null,
      balanceHeader: balHeader,
      totalAccountsOnTape: records.length,
    };
  }
  const accounts: TapeAccountInput[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const accountKey = (r[acctHeader] ?? "").trim();
    if (!accountKey) continue;
    const balRaw = balHeader ? (r[balHeader] ?? "") : "";
    const cleaned = balRaw.replace(/[$,\s]/g, "");
    const faceValue = cleaned === "" || cleaned === "-" ? 0 : Number(cleaned);
    accounts.push({
      accountKey,
      rowIndex: i + 1,
      faceValue: Number.isFinite(faceValue) ? faceValue : 0,
    });
  }
  return {
    accounts,
    accountNumberHeader: acctHeader,
    balanceHeader: balHeader,
    totalAccountsOnTape: records.length,
  };
}

export async function analyzeMediaZip(
  zipBytes: Uint8Array,
  tapeAccounts: TapeAccountInput[]
): Promise<ChainOfCustodyReport> {
  const entries = await listZipEntries(zipBytes);
  return buildReport(entries, tapeAccounts);
}

export function buildReport(
  entries: ZipEntry[],
  tapeAccounts: TapeAccountInput[]
): ChainOfCustodyReport {
  // Index accounts by key for fast lookup
  const accountByKey = new Map<string, TapeAccountInput>();
  for (const a of tapeAccounts) {
    if (a.accountKey && !accountByKey.has(a.accountKey)) {
      accountByKey.set(a.accountKey, a);
    }
  }
  // Sort keys longest-first so the matcher prefers full-account hits over
  // last-4 collisions.
  const sortedKeys = Array.from(accountByKey.keys()).sort((a, b) => b.length - a.length);

  // Per-account doc accumulator
  const docsByAccount = new Map<string, DocFile[]>();
  let matchedFiles = 0;
  let unmatchedFiles = 0;
  let totalBytes = 0;
  const unmatchedExamples: string[] = [];
  const byDocCategory: Record<DocCategory, { count: number; bytes: number }> = {
    bill_of_sale: { count: 0, bytes: 0 },
    assignment: { count: 0, bytes: 0 },
    affidavit_of_debt: { count: 0, bytes: 0 },
    custodian_affidavit: { count: 0, bytes: 0 },
    application: { count: 0, bytes: 0 },
    card_agreement: { count: 0, bytes: 0 },
    statement_history: { count: 0, bytes: 0 },
    itemization: { count: 0, bytes: 0 },
    payment_history: { count: 0, bytes: 0 },
    settlement_letter: { count: 0, bytes: 0 },
    media_inventory: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };

  for (const entry of entries) {
    totalBytes += entry.sizeBytes;
    const category = classifyDoc(entry.filename);
    byDocCategory[category].count++;
    byDocCategory[category].bytes += entry.sizeBytes;
    // Media-inventory files aren't matched to accounts; just tallied.
    if (category === "media_inventory") {
      matchedFiles++; // count as "useful" for the zip-stats line
      continue;
    }
    const accountKey = matchFilenameToAccount(entry.filename, sortedKeys);
    if (accountKey) {
      matchedFiles++;
      const list = docsByAccount.get(accountKey) ?? [];
      list.push({
        filename: entry.filename,
        sizeBytes: entry.sizeBytes,
        category,
      });
      docsByAccount.set(accountKey, list);
    } else {
      unmatchedFiles++;
      if (unmatchedExamples.length < 20) unmatchedExamples.push(entry.filename);
    }
  }

  // Score every tape account (including those with no docs found)
  const perAccount: AccountDocs[] = [];
  let totalFaceAnalyzed = 0;
  let enforceableFaceValue = 0;
  let partialFaceValue = 0;
  let uncollectableFaceValue = 0;
  let accountsWithNoDocs = 0;
  let accountsWithBillOfSale = 0;
  let accountsWithAssignment = 0;
  let accountsWithOriginationDocs = 0;
  let accountsWithItemization = 0;

  for (const account of tapeAccounts) {
    if (!account.accountKey) continue;
    const docs = docsByAccount.get(account.accountKey) ?? [];
    const score = scoreAccountEnforceability(docs);
    perAccount.push({
      accountKey: account.accountKey,
      rowIndex: account.rowIndex,
      faceValue: account.faceValue,
      docs,
      hasBillOfSale: score.hasBillOfSale,
      hasAssignment: score.hasAssignment,
      hasOriginationDocs: score.hasOriginationDocs,
      hasItemization: score.hasItemization,
      enforceabilityScore: score.score,
      enforceabilityStatus: score.status,
    });
    totalFaceAnalyzed += account.faceValue;
    if (score.status === "green") enforceableFaceValue += account.faceValue;
    else if (score.status === "yellow") partialFaceValue += account.faceValue;
    else uncollectableFaceValue += account.faceValue;
    if (docs.length === 0) accountsWithNoDocs++;
    if (score.hasBillOfSale) accountsWithBillOfSale++;
    if (score.hasAssignment) accountsWithAssignment++;
    if (score.hasOriginationDocs) accountsWithOriginationDocs++;
    if (score.hasItemization) accountsWithItemization++;
  }

  return {
    totalFilesInZip: entries.length,
    totalBytesInZip: totalBytes,
    matchedFiles,
    unmatchedFiles,
    byDocCategory,
    unmatchedExamples,
    perAccount,
    totalAccountsOnTape: tapeAccounts.length,
    totalFaceAnalyzed,
    enforceableFaceValue,
    partialFaceValue,
    uncollectableFaceValue,
    accountsWithNoDocs,
    accountsWithBillOfSale,
    accountsWithAssignment,
    accountsWithOriginationDocs,
    accountsWithItemization,
  };
}

// ---------------------------------------------------------------------------
// Missing-docs CSV export — for the operator to demand from seller before
// closing. Same privacy approach as cliff queue: row index + account key
// (operator-known, since they uploaded the tape) + per-category missing flags.
// ---------------------------------------------------------------------------

export function missingDocsCsv(report: ChainOfCustodyReport): string {
  const header = [
    "row_index",
    "face_value",
    "status",
    "missing_bill_of_sale",
    "missing_assignment",
    "missing_origination_docs",
    "missing_itemization",
    "docs_present_count",
    "docs_present_categories",
  ];
  const lines = [header.join(",")];
  for (const a of report.perAccount) {
    if (a.enforceabilityStatus === "green") continue;
    const cats = Array.from(new Set(a.docs.map((d) => d.category))).sort().join(";");
    lines.push(
      [
        String(a.rowIndex),
        a.faceValue.toFixed(2),
        a.enforceabilityStatus,
        a.hasBillOfSale ? "no" : "yes",
        a.hasAssignment ? "no" : "yes",
        a.hasOriginationDocs ? "no" : "yes",
        a.hasItemization ? "no" : "yes",
        String(a.docs.length),
        cats,
      ].join(",")
    );
  }
  return lines.join("\n");
}
