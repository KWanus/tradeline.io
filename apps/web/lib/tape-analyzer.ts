// Tape analyzer — aggregate-only. Parses a CSV in memory, computes summary
// statistics, and DISCARDS the row data immediately. PII columns (name,
// address, phone, account number, SSN) are never read into the output. Any
// header that looks like consumer PII is logged as "redacted" and skipped.
//
// V2: Layered onto the existing aggregate analyzer is a deep canonical-schema
// pass — header → canonical field mapping (60+ fields), Reg F minimum-field
// compliance check, completeness grade, originator fingerprint (tells you
// "this is a CompuCredit-era tape, balance includes pre-CO interest"), and
// balance-convention detection from row data. All still in-browser; row data
// is read for the balance comparison ONLY and discarded immediately.
//
// This module runs entirely in the browser via the tape uploader's Client
// Component — uploaded files never leave the user's machine.

import {
  CANONICAL_FIELDS,
  checkRegFMinimum,
  computeCompleteness,
  detectCanonicalFields,
  getFieldByName,
  isNullSentinel,
  type CompletenessScore,
  type RegFCheckResult,
  type SchemaDetection,
} from "./tape-canonical-schema";
import {
  detectBalanceConvention,
  detectOriginatorFingerprint,
  type BalanceConventionEvidence,
  type FingerprintDetection,
} from "./tape-originator-fingerprint";
import {
  computeSolForAccount,
  debtTypeToSolBucket,
  parseTapeDate,
  summarizeSolReport,
  type SolPerAccount,
  type SolReport,
} from "./tape-sol";

export type ColumnHints = {
  balance: string | null;
  state: string | null;
  vintage: string | null;
  assetClass: string | null;
  redacted: string[];
};

export type StateBucket = { state: string; count: number; faceValue: number };
export type VintageBucket = { period: string; count: number; faceValue: number };
export type AssetBucket = { name: string; count: number; faceValue: number };

export type TapeAggregates = {
  rowCount: number;
  totalFaceValue: number;
  averageBalance: number;
  medianBalance: number;
  minBalance: number;
  maxBalance: number;
  stateDistribution: StateBucket[];
  vintageDistribution: VintageBucket[];
  assetClassDistribution: AssetBucket[];
  hints: ColumnHints;
  warnings: string[];
  // ---- V2 deep analysis (additive — old consumers ignore these) ----------
  // Canonical schema mapping: which of the 60+ canonical fields are present.
  schema: SchemaDetection;
  // Reg F §1006.34 minimum-field compliance check.
  regF: RegFCheckResult;
  // Schema completeness grade (A-F) and per-category breakdown.
  completeness: CompletenessScore;
  // Originator fingerprint (CompuCredit/Spiegel/fintech/etc.) + balance
  // convention warnings.
  fingerprint: FingerprintDetection;
  // Empirical balance-convention check from sampled rows.
  balanceConvention: BalanceConventionEvidence;
  // Per-account statute-of-limitations report + cliff queue. Null if the
  // tape doesn't have enough fields to compute (no state, or no date
  // anchors). Compliance signal, not legal advice.
  solReport: SolReport | null;
};

const PII_PATTERNS: RegExp[] = [
  /^(first_?|last_?)?name$/i,
  /^full_?name$/i,
  /^address(_?\d)?$/i,
  /^street(_?address)?$/i,
  /^city$/i,
  /^zip(code)?$/i,
  /^postal(_?code)?$/i,
  /^phone(_?number)?$/i,
  /^home_?phone$/i,
  /^mobile_?phone$/i,
  /^email$/i,
  /^ssn$/i,
  /^social_?security/i,
  /^date_?of_?birth$/i,
  /^dob$/i,
  /^account_?(no|num|number)$/i,
  /^debtor_?id$/i,
  /^card_?(no|number)$/i,
];

const COLUMN_PATTERNS = {
  balance: [
    /^(account_)?balance$/i,
    /^face_?value$/i,
    /^principal(_?balance)?$/i,
    /^amount(_?owed)?$/i,
    /^total_?owed$/i,
    /^upb$/i,
    /^current_?balance$/i,
    /^charged?_?off_?balance$/i,
  ],
  state: [/^state$/i, /^st$/i, /^billing_?state$/i, /^debtor_?state$/i, /^addr_?state$/i],
  vintage: [
    /^charge_?off_?date$/i,
    /^co_?date$/i,
    /^vintage$/i,
    /^delinquency_?date$/i,
    /^last_?payment_?date$/i,
    /^cdr$/i,
    /^date_?of_?charge_?off$/i,
  ],
  assetClass: [/^asset_?type$/i, /^product(_?type)?$/i, /^loan_?type$/i, /^class$/i, /^debt_?type$/i],
};

function detectColumns(headers: string[]): ColumnHints {
  const findFirst = (patterns: RegExp[]): string | null => {
    for (const h of headers) {
      const trimmed = h.trim();
      if (patterns.some((p) => p.test(trimmed))) return trimmed;
    }
    return null;
  };
  const redacted = headers
    .map((h) => h.trim())
    .filter((h) => PII_PATTERNS.some((p) => p.test(h)));
  return {
    balance: findFirst(COLUMN_PATTERNS.balance),
    state: findFirst(COLUMN_PATTERNS.state),
    vintage: findFirst(COLUMN_PATTERNS.vintage),
    assetClass: findFirst(COLUMN_PATTERNS.assetClass),
    redacted,
  };
}

// Minimal CSV parser — handles quoted fields with embedded commas and ""
// escapes. Does NOT handle multi-line quoted cells; those are rare in
// NPL tape exports. Returns headers + array of records.
export function parseCsv(text: string): {
  headers: string[];
  records: Record<string, string>[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], records: [] };

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") {
          out.push(cur);
          cur = "";
        } else cur += c;
      }
    }
    out.push(cur);
    return out;
  };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitLine(lines[i]);
    if (fields.length === 1 && fields[0].trim() === "") continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (fields[j] ?? "").trim();
    }
    records.push(row);
  }
  return { headers, records };
}

function parseDollar(raw: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseVintageYear(raw: string): number | null {
  if (!raw) return null;
  // Try ISO first (YYYY-MM-DD or YYYY/MM/DD or YYYY-MM)
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})/);
  if (iso) return Number(iso[1]);
  // Try US (MM/DD/YYYY or M/D/YY)
  const us = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    let yr = Number(us[3]);
    if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    return yr;
  }
  // Bare year
  const bare = raw.match(/^(\d{4})$/);
  if (bare) return Number(bare[1]);
  // Fallback: any 4-digit number 1990-2099
  const m = raw.match(/(19\d{2}|20\d{2})/);
  return m ? Number(m[1]) : null;
}

function topN<T extends { count: number }>(arr: T[], n: number): T[] {
  return [...arr].sort((a, b) => b.count - a.count).slice(0, n);
}

export function analyze(csvText: string): TapeAggregates {
  const { headers, records } = parseCsv(csvText);
  const hints = detectColumns(headers);
  const warnings: string[] = [];

  // ---- V2 deep schema analysis (header-only, runs before row iteration) --
  const schema = detectCanonicalFields(headers);
  const regF = checkRegFMinimum(schema);
  const completeness = computeCompleteness(schema, regF);
  const fingerprint = detectOriginatorFingerprint(headers, schema);

  // Headers of canonical balance fields (if detected) used for the in-row
  // balance-convention comparison below. These are non-PII (numeric), so
  // reading them is consistent with the privacy posture.
  const accountBalanceHeader =
    schema.byCanonical.get("account_balance")?.header ?? hints.balance ?? null;
  const chargeOffBalanceHeader = schema.byCanonical.get("charge_off_balance")?.header ?? null;
  const accountBalanceField = getFieldByName("account_balance");
  const chargeOffBalanceField = getFieldByName("charge_off_balance");

  if (records.length === 0) warnings.push("No data rows detected.");
  if (!hints.balance) warnings.push("No balance column detected — face value cannot be computed.");
  if (!hints.state) warnings.push("No state column detected — geographic mix unavailable.");
  if (!hints.vintage) warnings.push("No charge-off date / vintage column detected.");
  if (hints.redacted.length > 0) {
    warnings.push(
      `${hints.redacted.length} consumer-PII column(s) detected (${hints.redacted.slice(0, 3).join(", ")}${hints.redacted.length > 3 ? "…" : ""}). These were skipped — Tradeline only computes aggregates.`
    );
  }

  // Deep-analysis warnings — surface the Reg F failures, schema grade, and
  // fingerprint warnings up to the operator alongside the existing flags.
  if (!regF.pass) {
    warnings.push(
      `Reg F minimum check FAILED — missing: ${regF.missing.join(", ")}. This tape cannot legally support a validation notice without seller supplementation.`
    );
  }
  if (completeness.grade === "D" || completeness.grade === "F") {
    warnings.push(
      `Schema completeness grade ${completeness.grade} (${Math.round(completeness.weighted * 100)}% weighted) — the tape is sparse. Re-verify with the seller before bidding.`
    );
  }
  if (fingerprint.topMatch && fingerprint.topMatch.confidence >= 0.5) {
    for (const w of fingerprint.topMatch.fingerprint.warnings) {
      warnings.push(`[${fingerprint.topMatch.fingerprint.label}] ${w}`);
    }
  }
  for (const c of fingerprint.conflicts) {
    warnings.push(`Fingerprint conflict: ${c}`);
  }

  const balances: number[] = [];
  const stateMap = new Map<string, { count: number; faceValue: number }>();
  const vintageMap = new Map<string, { count: number; faceValue: number }>();
  const assetMap = new Map<string, { count: number; faceValue: number }>();
  // Collected pairs for balance-convention detection. Capped at 1k rows to
  // keep large-tape parsing fast — the convention is consistent within a
  // tape so a sample is sufficient.
  const balancePairs: Array<{ accountBalance: number; chargeOffBalance: number }> = [];
  const PAIR_SAMPLE_CAP = 1000;

  // ---- SOL per-account computation (V2) --------------------------------
  // Compute when we have state + at least one date anchor. Capped at 100k
  // accounts to bound memory; tapes larger than that get summary-only.
  const lastPaymentHeader = schema.byCanonical.get("last_payment_date")?.header ?? null;
  const chargeOffHeader = schema.byCanonical.get("charge_off_date")?.header ?? null;
  const openDateHeader = schema.byCanonical.get("account_opened_date")?.header ?? null;
  const judgmentDateHeader = schema.byCanonical.get("judgment_date")?.header ?? null;
  const judgmentStateHeader = schema.byCanonical.get("judgment_state")?.header ?? null;
  const assetTypeHeader = schema.byCanonical.get("asset_type")?.header ?? hints.assetClass ?? null;
  const solStateHeader = schema.byCanonical.get("state")?.header ?? hints.state ?? null;
  const canComputeSol =
    !!solStateHeader && (!!lastPaymentHeader || !!chargeOffHeader || !!openDateHeader || !!judgmentDateHeader);
  const SOL_ACCOUNT_CAP = 100_000;
  const solPerAccount: SolPerAccount[] = [];
  const today = new Date();

  for (let rowIdx = 0; rowIdx < records.length; rowIdx++) {
    const r = records[rowIdx];
    const bal = hints.balance ? parseDollar(r[hints.balance] ?? "") : NaN;
    if (Number.isFinite(bal) && bal > 0) balances.push(bal);

    if (hints.state) {
      const s = (r[hints.state] ?? "").trim().toUpperCase().slice(0, 2);
      if (s) {
        const cur = stateMap.get(s) ?? { count: 0, faceValue: 0 };
        cur.count++;
        if (Number.isFinite(bal)) cur.faceValue += bal;
        stateMap.set(s, cur);
      }
    }
    if (hints.vintage) {
      const yr = parseVintageYear(r[hints.vintage] ?? "");
      if (yr) {
        const key = String(yr);
        const cur = vintageMap.get(key) ?? { count: 0, faceValue: 0 };
        cur.count++;
        if (Number.isFinite(bal)) cur.faceValue += bal;
        vintageMap.set(key, cur);
      }
    }
    if (hints.assetClass) {
      const a = (r[hints.assetClass] ?? "").trim();
      if (a) {
        const cur = assetMap.get(a) ?? { count: 0, faceValue: 0 };
        cur.count++;
        if (Number.isFinite(bal)) cur.faceValue += bal;
        assetMap.set(a, cur);
      }
    }

    // Balance-convention pair collection. Only when BOTH columns exist and
    // we're under the sample cap.
    if (
      accountBalanceHeader &&
      chargeOffBalanceHeader &&
      accountBalanceField &&
      chargeOffBalanceField &&
      balancePairs.length < PAIR_SAMPLE_CAP
    ) {
      const accRaw = r[accountBalanceHeader] ?? "";
      const coRaw = r[chargeOffBalanceHeader] ?? "";
      if (
        !isNullSentinel(accRaw, accountBalanceField.dataType) &&
        !isNullSentinel(coRaw, chargeOffBalanceField.dataType)
      ) {
        const acc = parseDollar(accRaw);
        const co = parseDollar(coRaw);
        if (Number.isFinite(acc) && Number.isFinite(co) && co > 0) {
          balancePairs.push({ accountBalance: acc, chargeOffBalance: co });
        }
      }
    }

    // ---- Per-account SOL --------------------------------------------------
    if (canComputeSol && solPerAccount.length < SOL_ACCOUNT_CAP) {
      const stateRaw = solStateHeader ? r[solStateHeader] : null;
      const state = stateRaw ? stateRaw.trim().toUpperCase().slice(0, 2) : null;
      const assetRaw = assetTypeHeader ? (r[assetTypeHeader] ?? "") : null;
      const bucket = debtTypeToSolBucket(assetRaw);
      const lastPaymentDate = lastPaymentHeader ? parseTapeDate(r[lastPaymentHeader]) : null;
      const chargeOffDate = chargeOffHeader ? parseTapeDate(r[chargeOffHeader]) : null;
      const openDate = openDateHeader ? parseTapeDate(r[openDateHeader]) : null;
      const judgmentDate = judgmentDateHeader ? parseTapeDate(r[judgmentDateHeader]) : null;
      const judgmentState = judgmentStateHeader
        ? (r[judgmentStateHeader] ?? "").trim().toUpperCase().slice(0, 2)
        : null;
      const result = computeSolForAccount({
        state,
        bucket,
        lastPaymentDate,
        chargeOffDate,
        openDate,
        judgmentDate,
        judgmentState,
        today,
      });
      // Face value for this row: prefer canonical account_balance, fall back
      // to whatever the hint column found.
      const faceValue = Number.isFinite(bal) && bal > 0 ? bal : 0;
      solPerAccount.push({ ...result, rowIndex: rowIdx + 1, faceValue });
    }
  }

  const totalFaceValue = balances.reduce((a, b) => a + b, 0);
  const sorted = [...balances].sort((a, b) => a - b);
  const median = sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const avg = balances.length === 0 ? 0 : totalFaceValue / balances.length;

  // Quality flags
  if (balances.length > 0 && new Set(balances).size === 1) {
    warnings.push("Every account has the identical balance — likely placeholder data.");
  }
  if (balances.length > 0 && balances.length < records.length * 0.7) {
    warnings.push(
      `Only ${balances.length} of ${records.length} rows had a parseable balance. Verify the column.`
    );
  }

  // Balance-convention check from sampled pairs (or fingerprint fallback)
  const balanceConvention = detectBalanceConvention(
    balancePairs,
    fingerprint.balanceConvention === "unknown" ? null : fingerprint.balanceConvention
  );
  if (balanceConvention.warning) {
    warnings.push(`[balance convention] ${balanceConvention.warning}`);
  }

  // SOL report — only if we collected per-account results
  const solReport = solPerAccount.length > 0 ? summarizeSolReport(solPerAccount) : null;
  if (solReport) {
    const lapsedCount = solReport.byStatus.lapsed.count;
    const cliff90Count = solReport.byStatus.cliff_30.count + solReport.byStatus.cliff_90.count;
    if (lapsedCount > 0) {
      warnings.push(
        `[SOL] ${lapsedCount.toLocaleString()} account(s) (${formatUSDShort(solReport.lapsedFaceValue)} face) already past statute of limitations — uncollectable by suit. Discount face accordingly.`
      );
    }
    if (cliff90Count > 0) {
      warnings.push(
        `[SOL] ${cliff90Count.toLocaleString()} account(s) (${formatUSDShort(solReport.cliff90FaceValue)} face) within 90 days of SOL lapse — top of the outreach queue.`
      );
    }
    if (solReport.anchorMix.none > solReport.totalAccountsAnalyzed * 0.2) {
      warnings.push(
        `[SOL] ${solReport.anchorMix.none.toLocaleString()} account(s) have no date anchor — SOL status unknown for those rows.`
      );
    }
  } else if (canComputeSol === false && solStateHeader) {
    warnings.push(
      `[SOL] State present but no date anchor — could not compute per-account SOL.`
    );
  }

  return {
    rowCount: records.length,
    totalFaceValue,
    averageBalance: avg,
    medianBalance: median,
    minBalance: min,
    maxBalance: max,
    stateDistribution: topN(
      [...stateMap.entries()].map(([state, v]) => ({ state, ...v })),
      8
    ),
    vintageDistribution: [...vintageMap.entries()]
      .map(([period, v]) => ({ period, ...v }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    assetClassDistribution: topN(
      [...assetMap.entries()].map(([name, v]) => ({ name, ...v })),
      6
    ),
    hints,
    warnings,
    schema,
    regF,
    completeness,
    fingerprint,
    balanceConvention,
    solReport,
  };
}

// Compact USD formatter for analyzer-side warnings (UI components have their
// own formatters but warnings strings are constructed here).
function formatUSDShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Bid heuristic — couples tape aggregates with the bid calculator's NPV math.
// Reuses the same defaults as the standalone calculator so the answers line
// up. No tape data leaves the browser.
// ---------------------------------------------------------------------------

export type BidHeuristicInput = {
  totalFaceValue: number;
  // Per-asset-class defaults; pick best-fit by detected asset class or
  // user override.
  recoveryPct: number;       // gross recovery as % of face
  workoutYears: number;      // years to fully realize recovery
  servicerFeePct: number;    // % of collected dollars taken by servicer
  irrPct: number;            // target IRR
};

export type BidHeuristicOutput = {
  grossRecovery: number;
  netToBuyer: number;
  maxBid: number;
  maxBidCentsPerDollar: number;
  disciplinedBid: number;
  disciplinedBidCentsPerDollar: number;
};

export function computeBid(input: BidHeuristicInput): BidHeuristicOutput {
  const { totalFaceValue, recoveryPct, workoutYears, servicerFeePct, irrPct } = input;
  const grossRecovery = totalFaceValue * (recoveryPct / 100);
  const netToBuyer = grossRecovery * (1 - servicerFeePct / 100);
  const discount = Math.pow(1 + irrPct / 100, workoutYears);
  const maxBid = discount === 0 ? 0 : netToBuyer / discount;
  const disciplinedBid = maxBid * 0.85;
  return {
    grossRecovery,
    netToBuyer,
    maxBid,
    maxBidCentsPerDollar: totalFaceValue === 0 ? 0 : (maxBid / totalFaceValue) * 100,
    disciplinedBid,
    disciplinedBidCentsPerDollar:
      totalFaceValue === 0 ? 0 : (disciplinedBid / totalFaceValue) * 100,
  };
}

// Asset-class default heuristics — same numbers as the bid calculator presets,
// keyed by case-insensitive substring match against the detected asset class.
export type AssetDefaults = {
  label: string;
  recoveryPct: number;
  workoutYears: number;
  servicerFeePct: number;
  irrPct: number;
};

export const ASSET_DEFAULTS: AssetDefaults[] = [
  {
    label: "Credit card (fresh charge-off)",
    recoveryPct: 14,
    workoutYears: 5,
    servicerFeePct: 35,
    irrPct: 30,
  },
  {
    label: "Credit card (aged 1-3 years)",
    recoveryPct: 7,
    workoutYears: 4,
    servicerFeePct: 35,
    irrPct: 35,
  },
  {
    label: "Auto / subprime auto (secured)",
    recoveryPct: 22,
    workoutYears: 3,
    servicerFeePct: 25,
    irrPct: 25,
  },
  {
    label: "Junior mortgage (seasoned)",
    recoveryPct: 55,
    workoutYears: 4,
    servicerFeePct: 15,
    irrPct: 20,
  },
  {
    label: "Medical debt",
    recoveryPct: 6,
    workoutYears: 4,
    servicerFeePct: 35,
    irrPct: 35,
  },
];

// Suggest defaults from detected asset class string. Returns undefined if no
// match — caller falls back to credit-card-fresh defaults.
export function suggestDefaults(detected: string | null | undefined): AssetDefaults {
  if (!detected) return ASSET_DEFAULTS[0];
  const d = detected.toLowerCase();
  if (d.includes("auto") || d.includes("vehicle") || d.includes("car")) return ASSET_DEFAULTS[2];
  if (d.includes("medic") || d.includes("hospital") || d.includes("health")) return ASSET_DEFAULTS[4];
  if (d.includes("mortgage") || d.includes("real") || d.includes("property") || d.includes("re ")) {
    return ASSET_DEFAULTS[3];
  }
  if (d.includes("aged") || d.includes("old") || d.includes("seasoned")) return ASSET_DEFAULTS[1];
  return ASSET_DEFAULTS[0];
}
