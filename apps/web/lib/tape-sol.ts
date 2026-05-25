// Per-account statute-of-limitations math + tape-level cliff report.
//
// Most B2B debt-tooling exposes a state SOL matrix as a reference table.
// What this module ships — and what no incumbent product does — is
// PER-ACCOUNT SOL computation at parse time, then a tape-level cliff
// queue showing which accounts lapse soon. The Spiegel-Midland 2007
// agreement is explicit: "Buyer agrees that it shall be responsible to
// determine the applicable Statute of Limitations for all accounts in
// the sale." Sellers don't compute it; buyers must.
//
// Compliance posture: this is a compliance signal, not legal advice.
// State SOL choice-of-law, tolling, partial-payment revival, and
// judgment-enforcement statutes are state-specific and fact-specific.
// Always have counsel verify before bidding, filing suit, or sending
// time-bar disclosures. The cliff queue is an operational prioritization
// tool, not a litigation green-light.

import { SOL_CHART } from "./sol-chart";

// ---------------------------------------------------------------------------
// SOL bucket mapping — which SOL column applies per asset class
// ---------------------------------------------------------------------------

export type SolBucket =
  | "cc" // credit card / open account / revolving / store card
  | "written" // installment / written contract (auto, personal, student, mortgage)
  | "judgment" // judgment enforcement period (different statute entirely)
  | "none"; // federal student loans, federal tax liens — no SOL

export function debtTypeToSolBucket(debtType: string | null | undefined): SolBucket {
  if (!debtType) return "cc"; // shortest SOL — conservative default
  const d = debtType.toLowerCase();
  if (/federal[ _]?student|fed[ _]?loan|stafford|perkins|plus[ _]?loan/.test(d)) return "none";
  if (/federal[ _]?tax|irs[ _]?lien/.test(d)) return "none";
  if (/judgment|enforcement/.test(d)) return "judgment";
  if (/credit[ _]?card|\bcc\b|revolving|charge[ _]?card|store[ _]?card|retail[ _]?card/.test(d))
    return "cc";
  if (/auto|vehicle|car[ _]?loan/.test(d)) return "written";
  if (/medical|hospital|healthcare/.test(d)) return "cc";
  if (/mortgage|home[ _]?equity|heloc|second[ _]?lien|junior[ _]?lien/.test(d)) return "written";
  if (/student|education/.test(d)) return "written"; // private student loans
  if (/personal|installment|signature/.test(d)) return "written";
  if (/commercial|business|sba/.test(d)) return "written";
  if (/telecom|utility|wireless|cable/.test(d)) return "cc";
  return "cc";
}

// ---------------------------------------------------------------------------
// Account-level SOL computation
// ---------------------------------------------------------------------------

export type SolStatus =
  | "lapsed" // SOL already expired
  | "cliff_30" // expires within 30 days
  | "cliff_90" // 31–90 days
  | "cliff_180" // 91–180 days
  | "healthy" // > 180 days remaining
  | "unknown"; // missing data — can't compute

export type SolAnchorSource =
  | "last_payment_date"
  | "charge_off_date"
  | "open_date"
  | "judgment_date"
  | "none";

export type AccountSolResult = {
  state: string | null;
  bucket: SolBucket;
  // Date the SOL clock is counting from.
  anchor: Date | null;
  anchorSource: SolAnchorSource;
  // Date the SOL expires.
  expiresOn: Date | null;
  daysToLapse: number | null;
  status: SolStatus;
  notes?: string;
};

export function computeSolForAccount(input: {
  state: string | null | undefined;
  bucket: SolBucket;
  lastPaymentDate: Date | null;
  chargeOffDate: Date | null;
  openDate: Date | null;
  judgmentDate?: Date | null;
  judgmentState?: string | null;
  today?: Date;
}): AccountSolResult {
  const today = input.today ?? new Date();

  // Judgment branch: enforcement period replaces underlying-debt SOL.
  // Most states allow 10–20 years to enforce a judgment; revival rules vary.
  // V1 uses a flat 10-year conservative default — counsel must verify by
  // judgment state for any litigation decisions.
  if (input.judgmentDate) {
    const expires = addYears(input.judgmentDate, 10);
    const daysToLapse = daysBetween(today, expires);
    return {
      state: input.state ?? null,
      bucket: "judgment",
      anchor: input.judgmentDate,
      anchorSource: "judgment_date",
      expiresOn: expires,
      daysToLapse,
      status: statusFromDays(daysToLapse),
      notes:
        "Judgment enforcement period — 10y default. State-specific revival and renewal rules apply; verify with counsel.",
    };
  }

  if (input.bucket === "none") {
    return {
      state: input.state ?? null,
      bucket: "none",
      anchor: null,
      anchorSource: "none",
      expiresOn: null,
      daysToLapse: null,
      status: "healthy",
      notes: "Federal student / tax debt — no statute of limitations.",
    };
  }

  if (!input.state) {
    return {
      state: null,
      bucket: input.bucket,
      anchor: pickAnchor(input).date,
      anchorSource: pickAnchor(input).source,
      expiresOn: null,
      daysToLapse: null,
      status: "unknown",
      notes: "No state on row — cannot compute SOL.",
    };
  }

  const stateCode = input.state.trim().toUpperCase();
  const entry = SOL_CHART.find((s) => s.state === stateCode);
  if (!entry) {
    return {
      state: stateCode,
      bucket: input.bucket,
      anchor: null,
      anchorSource: "none",
      expiresOn: null,
      daysToLapse: null,
      status: "unknown",
      notes: `State '${stateCode}' not in SOL chart — likely non-US territory or typo.`,
    };
  }

  const years = input.bucket === "cc" ? entry.cc : entry.written;
  const anchor = pickAnchor(input);

  if (!anchor.date) {
    return {
      state: stateCode,
      bucket: input.bucket,
      anchor: null,
      anchorSource: "none",
      expiresOn: null,
      daysToLapse: null,
      status: "unknown",
      notes: "No date anchor (no last_payment, charge_off, or open date).",
    };
  }

  const expires = addYears(anchor.date, years);
  const daysToLapse = daysBetween(today, expires);

  const notes: string[] = [];
  if (anchor.source !== "last_payment_date") {
    notes.push(
      `SOL anchored at ${anchor.source} (last_payment_date missing). Most states require last-payment anchor — verify with counsel before relying on this for litigation.`
    );
  }
  if (entry.notes) notes.push(entry.notes);

  return {
    state: stateCode,
    bucket: input.bucket,
    anchor: anchor.date,
    anchorSource: anchor.source,
    expiresOn: expires,
    daysToLapse,
    status: statusFromDays(daysToLapse),
    notes: notes.length > 0 ? notes.join(" ") : undefined,
  };
}

function pickAnchor(input: {
  lastPaymentDate: Date | null;
  chargeOffDate: Date | null;
  openDate: Date | null;
}): { date: Date | null; source: SolAnchorSource } {
  if (input.lastPaymentDate) return { date: input.lastPaymentDate, source: "last_payment_date" };
  if (input.chargeOffDate) return { date: input.chargeOffDate, source: "charge_off_date" };
  if (input.openDate) return { date: input.openDate, source: "open_date" };
  return { date: null, source: "none" };
}

function addYears(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  out.setFullYear(out.getFullYear() + years);
  return out;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function statusFromDays(daysToLapse: number | null): SolStatus {
  if (daysToLapse === null) return "unknown";
  if (daysToLapse < 0) return "lapsed";
  if (daysToLapse <= 30) return "cliff_30";
  if (daysToLapse <= 90) return "cliff_90";
  if (daysToLapse <= 180) return "cliff_180";
  return "healthy";
}

// ---------------------------------------------------------------------------
// Tape-level SOL report
// ---------------------------------------------------------------------------

export type SolPerAccount = AccountSolResult & {
  rowIndex: number; // 0-based position in original tape (header is row 0; data starts at 1)
  faceValue: number; // account balance for this row
};

export type SolReport = {
  totalAccountsAnalyzed: number;
  // Distribution by status with count + face value
  byStatus: Record<SolStatus, { count: number; faceValue: number }>;
  // Per-account detail (capped for memory). Used for cliff queue export.
  perAccount: SolPerAccount[];
  // Operator-facing headlines
  lapsedFaceValue: number;
  cliff90FaceValue: number; // includes cliff_30 + cliff_90
  cliff180FaceValue: number; // all non-healthy non-unknown that are still in window
  // Source-of-anchor mix (transparency)
  anchorMix: Record<SolAnchorSource, number>;
};

const EMPTY_STATUS_BUCKET = (): { count: number; faceValue: number } => ({
  count: 0,
  faceValue: 0,
});

export function summarizeSolReport(perAccount: SolPerAccount[]): SolReport {
  const byStatus: SolReport["byStatus"] = {
    lapsed: EMPTY_STATUS_BUCKET(),
    cliff_30: EMPTY_STATUS_BUCKET(),
    cliff_90: EMPTY_STATUS_BUCKET(),
    cliff_180: EMPTY_STATUS_BUCKET(),
    healthy: EMPTY_STATUS_BUCKET(),
    unknown: EMPTY_STATUS_BUCKET(),
  };
  const anchorMix: SolReport["anchorMix"] = {
    last_payment_date: 0,
    charge_off_date: 0,
    open_date: 0,
    judgment_date: 0,
    none: 0,
  };

  for (const a of perAccount) {
    byStatus[a.status].count++;
    if (Number.isFinite(a.faceValue) && a.faceValue > 0) {
      byStatus[a.status].faceValue += a.faceValue;
    }
    anchorMix[a.anchorSource]++;
  }

  const lapsedFaceValue = byStatus.lapsed.faceValue;
  const cliff90FaceValue = byStatus.cliff_30.faceValue + byStatus.cliff_90.faceValue;
  const cliff180FaceValue = cliff90FaceValue + byStatus.cliff_180.faceValue;

  return {
    totalAccountsAnalyzed: perAccount.length,
    byStatus,
    perAccount,
    lapsedFaceValue,
    cliff90FaceValue,
    cliff180FaceValue,
    anchorMix,
  };
}

// ---------------------------------------------------------------------------
// Cliff queue CSV export
//
// Privacy-preserving format: we export ROW INDEX (not PII) + state +
// minimal SOL metadata. The operator joins back to their own tape using
// row index to recover names/addresses for prioritized outreach. This
// keeps the export safe to share, store, or audit without exposing
// consumer PII.
// ---------------------------------------------------------------------------

export function cliffQueueToCsv(report: SolReport, includeStatuses?: SolStatus[]): string {
  const allowed = new Set<SolStatus>(
    includeStatuses ?? ["lapsed", "cliff_30", "cliff_90", "cliff_180"]
  );
  const rows = report.perAccount.filter((a) => allowed.has(a.status));
  // Order: most-urgent first (lapsed → cliff_30 → cliff_90 → cliff_180)
  const order: Record<SolStatus, number> = {
    lapsed: 0,
    cliff_30: 1,
    cliff_90: 2,
    cliff_180: 3,
    healthy: 4,
    unknown: 5,
  };
  rows.sort((a, b) => {
    const s = order[a.status] - order[b.status];
    if (s !== 0) return s;
    return (a.daysToLapse ?? 0) - (b.daysToLapse ?? 0);
  });

  const header = [
    "row_index",
    "state",
    "sol_bucket",
    "anchor_source",
    "anchor_date",
    "sol_expires_on",
    "days_to_lapse",
    "status",
    "face_value",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        String(r.rowIndex),
        r.state ?? "",
        r.bucket,
        r.anchorSource,
        r.anchor ? r.anchor.toISOString().slice(0, 10) : "",
        r.expiresOn ? r.expiresOn.toISOString().slice(0, 10) : "",
        r.daysToLapse !== null ? String(r.daysToLapse) : "",
        r.status,
        Number.isFinite(r.faceValue) ? r.faceValue.toFixed(2) : "",
        csvEscape(r.notes ?? ""),
      ].join(",")
    );
  }
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Date parsing — debt tapes use many date formats. This handles the common
// ones (ISO, US, with/without separators, Excel serial). Returns null on
// sentinel values ("00/00/0000", "1/1/1900", etc.) or unparseable input.
// ---------------------------------------------------------------------------

export function parseTapeDate(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (v === "") return null;
  // Sentinel values
  if (/^0+[\/\-]0+[\/\-]0+$/.test(v)) return null;
  if (/^(01?)[\/\-](01?)[\/\-]1900$/.test(v)) return null;
  if (/^1900[\/\-]01[\/\-]01$/.test(v)) return null;
  if (/^9999[\/\-]12[\/\-]31$/.test(v) || /^12[\/\-]31[\/\-]9999$/.test(v)) return null;
  // ISO YYYY-MM-DD or YYYY/MM/DD
  const iso = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const yr = Number(iso[1]);
    const mo = Number(iso[2]) - 1;
    const dy = Number(iso[3]);
    const d = new Date(Date.UTC(yr, mo, dy));
    if (!Number.isNaN(d.getTime())) return d;
  }
  // US MM/DD/YYYY or M/D/YY
  const us = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (us) {
    let yr = Number(us[3]);
    if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    const mo = Number(us[1]) - 1;
    const dy = Number(us[2]);
    const d = new Date(Date.UTC(yr, mo, dy));
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Excel serial (days since 1900-01-01 with Excel's leap-year bug)
  const serial = Number(v);
  if (Number.isFinite(serial) && serial > 30000 && serial < 80000) {
    // Excel's 1900-based serial; subtract 25569 to get Unix epoch days, then ms
    const utcDays = serial - 25569;
    const d = new Date(utcDays * 86_400_000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
