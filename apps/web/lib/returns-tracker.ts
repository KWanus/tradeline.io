// Returns tracker — when a servicer flags an account as returnable
// (consumer dispute, bankruptcy, deceased, fraud, SCRA active duty), the
// operator has a contractual window (typically 90-180 days post-purchase
// per the bill of sale) to return it to the seller and recover a refund.
// Miss the window = ate the loss.
//
// This module records flagged accounts per-holding, computes return-window
// urgency, and generates the seller-facing notice text + CSV export the
// operator uses to actually demand the refund.
//
// Privacy: returns reference the operator's holding by id and the account
// by row index (in the holding's original tape). No consumer PII is
// stored. The notice template + CSV export both use row indices only —
// operator joins back to their own tape for the seller communication.
//
// Storage: localStorage at `tradeline.returns.v1`. Same single-tenant
// pattern as the rest of the operator OS.

export const RETURNS_STORAGE_KEY = "tradeline.returns.v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReturnReason =
  | "dispute" // consumer disputes the debt
  | "bankruptcy" // BK filed pre-purchase
  | "deceased" // consumer deceased before purchase
  | "scra" // active-duty military, SCRA protections
  | "fraud" // identity theft
  | "wrong_consumer" // tape misidentifies obligor
  | "settled_in_full" // pre-purchase settlement not disclosed
  | "double_sold" // already sold to another buyer
  | "other";

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  dispute: "Consumer dispute",
  bankruptcy: "Bankruptcy (pre-purchase)",
  deceased: "Deceased consumer",
  scra: "SCRA active duty",
  fraud: "Identity theft / fraud",
  wrong_consumer: "Wrong consumer on tape",
  settled_in_full: "Settled-in-full (undisclosed)",
  double_sold: "Already sold to another buyer",
  other: "Other",
};

export type ReturnStatus =
  | "flagged" // operator recorded; seller not yet contacted
  | "contacted" // demand sent to seller; awaiting refund
  | "returned" // refund received / credit applied
  | "rejected" // seller declined the return
  | "expired"; // return window passed without action

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  flagged: "Flagged",
  contacted: "Contacted seller",
  returned: "Returned ✓",
  rejected: "Seller rejected",
  expired: "Window expired",
};

export type ReturnRecord = {
  id: string;
  holdingId: string;
  rowIndex: number; // row in the holding's original tape (1-based)
  reason: ReturnReason;
  status: ReturnStatus;
  flaggedDate: string; // ISO date — when operator/servicer flagged it
  contactedDate?: string; // ISO date — when seller was contacted
  resolvedDate?: string; // ISO date — when returned/rejected/expired
  faceValueUsd: number; // face value of this account (from the tape)
  refundExpectedUsd?: number; // typically face × purchase-price-ratio
  refundReceivedUsd?: number; // actual refund amount when status=returned
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function readReturns(): ReturnRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RETURNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ReturnRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeReturns(returns: ReturnRecord[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(returns));
    return true;
  } catch {
    return false;
  }
}

export function upsertReturn(record: ReturnRecord): boolean {
  const all = readReturns();
  const i = all.findIndex((r) => r.id === record.id);
  if (i === -1) all.unshift(record);
  else all[i] = record;
  return writeReturns(all);
}

export function deleteReturn(id: string): boolean {
  const all = readReturns();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  return writeReturns(next);
}

// ---------------------------------------------------------------------------
// Return-window computation
//
// Standard secondary-market return windows by reason. The operator can
// override per holding (V2) — V1 uses these conservative defaults.
// ---------------------------------------------------------------------------

const RETURN_WINDOW_DAYS_BY_REASON: Record<ReturnReason, number> = {
  dispute: 60, // typically 30-90 day dispute-return clause
  bankruptcy: 180, // BK is the longest window
  deceased: 180,
  scra: 180,
  fraud: 180,
  wrong_consumer: 90,
  settled_in_full: 90,
  double_sold: 180,
  other: 90,
};

export function defaultWindowDaysFor(reason: ReturnReason): number {
  return RETURN_WINDOW_DAYS_BY_REASON[reason];
}

// Days remaining = (purchaseDate + windowDays) - now. Negative = expired.
export function daysRemainingInWindow(
  purchaseDate: string,
  reason: ReturnReason,
  now: Date = new Date()
): number | null {
  const purchase = new Date(purchaseDate);
  if (Number.isNaN(purchase.getTime())) return null;
  const expiry = new Date(purchase.getTime());
  expiry.setDate(expiry.getDate() + defaultWindowDaysFor(reason));
  return Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Per-holding enrichment + urgency
// ---------------------------------------------------------------------------

export type EnrichedReturn = ReturnRecord & {
  daysRemaining: number | null;
  urgencyTier: "expired" | "critical" | "warning" | "ok";
  refundExpectedAuto: number; // when refundExpectedUsd not set, derived from face
};

export function urgencyTierFor(daysRemaining: number | null): EnrichedReturn["urgencyTier"] {
  if (daysRemaining === null) return "ok";
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= 14) return "critical";
  if (daysRemaining <= 45) return "warning";
  return "ok";
}

// Helper to project owned-holding refund per account: refund = face × ratio
// where ratio = purchase-price / face for the holding. When holding's face
// is missing/zero we fall back to face × 0.05 (5¢/$ conservative).
export function autoRefundExpected(
  faceValueUsd: number,
  holdingFace?: number,
  holdingPurchase?: number
): number {
  if (holdingFace && holdingFace > 0 && holdingPurchase && holdingPurchase > 0) {
    const ratio = holdingPurchase / holdingFace;
    return faceValueUsd * ratio;
  }
  return faceValueUsd * 0.05;
}

export type HoldingForReturns = {
  id: string;
  ticker?: string;
  seller?: string;
  servicer?: string;
  assetClass?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  purchaseDate?: string;
};

export function enrichReturn(
  r: ReturnRecord,
  holding: HoldingForReturns | undefined,
  now: Date = new Date()
): EnrichedReturn {
  const days = holding?.purchaseDate
    ? daysRemainingInWindow(holding.purchaseDate, r.reason, now)
    : null;
  // Already-resolved returns don't count toward urgency
  const effectiveUrgency =
    r.status === "returned" || r.status === "rejected" || r.status === "expired"
      ? "ok"
      : urgencyTierFor(days);
  const refundExpectedAuto = autoRefundExpected(
    r.faceValueUsd,
    holding?.faceValueUsd,
    holding?.purchasePriceUsd
  );
  return {
    ...r,
    daysRemaining: days,
    urgencyTier: effectiveUrgency,
    refundExpectedAuto,
  };
}

// ---------------------------------------------------------------------------
// Tape-wide / portfolio-wide rollup
// ---------------------------------------------------------------------------

export type ReturnsReport = {
  allReturns: EnrichedReturn[];
  // Counts and totals across status
  countByStatus: Record<ReturnStatus, number>;
  totalFaceFlaggedUsd: number; // face value flagged + not yet returned
  totalRefundExpectedUsd: number; // sum of refund-expected on open returns
  totalRefundReceivedUsd: number; // sum of refund-received on closed returns
  // Urgency rollup — open returns by urgency tier
  urgentReturns: EnrichedReturn[]; // critical + expired, oldest-window first
  // Headline recommendation
  headline: string;
};

export function buildReturnsReport(
  allReturns: ReturnRecord[],
  holdingsById: Map<string, HoldingForReturns>,
  now: Date = new Date()
): ReturnsReport {
  const enriched = allReturns.map((r) => enrichReturn(r, holdingsById.get(r.holdingId), now));
  const countByStatus: ReturnsReport["countByStatus"] = {
    flagged: 0,
    contacted: 0,
    returned: 0,
    rejected: 0,
    expired: 0,
  };
  let totalFaceFlagged = 0;
  let totalRefundExpected = 0;
  let totalRefundReceived = 0;
  for (const r of enriched) {
    countByStatus[r.status]++;
    if (r.status === "flagged" || r.status === "contacted") {
      totalFaceFlagged += r.faceValueUsd;
      totalRefundExpected += r.refundExpectedUsd ?? r.refundExpectedAuto;
    }
    if (r.status === "returned" && r.refundReceivedUsd) {
      totalRefundReceived += r.refundReceivedUsd;
    }
  }

  // Urgent = open + critical or expired, sorted by daysRemaining ascending
  const urgent = enriched
    .filter(
      (r) =>
        (r.status === "flagged" || r.status === "contacted") &&
        (r.urgencyTier === "critical" || r.urgencyTier === "expired")
    )
    .sort((a, b) => (a.daysRemaining ?? -9999) - (b.daysRemaining ?? -9999));

  let headline: string;
  if (enriched.length === 0) {
    headline = "No returns flagged. When a servicer flags an account, add it here to track the window.";
  } else if (urgent.length === 0) {
    const open = countByStatus.flagged + countByStatus.contacted;
    if (open > 0) {
      headline = `${open} open return${open === 1 ? "" : "s"} — none urgent. Refund expected: ${formatUsdShort(totalRefundExpected)}.`;
    } else {
      headline = `All flagged returns resolved. Total recovered: ${formatUsdShort(totalRefundReceived)}.`;
    }
  } else {
    const expired = urgent.filter((r) => r.urgencyTier === "expired").length;
    if (expired > 0) {
      headline = `${expired} return${expired === 1 ? "" : "s"} past window (${formatUsdShort(urgent.filter((r) => r.urgencyTier === "expired").reduce((s, r) => s + r.faceValueUsd, 0))} face) + ${urgent.length - expired} within 14 days. Send notices NOW.`;
    } else {
      headline = `${urgent.length} return${urgent.length === 1 ? "" : "s"} within 14 days of window expiry — ${formatUsdShort(urgent.reduce((s, r) => s + (r.refundExpectedUsd ?? r.refundExpectedAuto), 0))} refund at risk. Send notices this week.`;
    }
  }

  return {
    allReturns: enriched,
    countByStatus,
    totalFaceFlaggedUsd: totalFaceFlagged,
    totalRefundExpectedUsd: totalRefundExpected,
    totalRefundReceivedUsd: totalRefundReceived,
    urgentReturns: urgent,
    headline,
  };
}

// ---------------------------------------------------------------------------
// Notice text generator — seller-facing return demand
// ---------------------------------------------------------------------------

export function generateReturnNoticeText(input: {
  operatorName?: string;
  holding: HoldingForReturns;
  returns: EnrichedReturn[];
  date?: string; // ISO; defaults to today
}): string {
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const tickerOrSeller = input.holding.ticker || input.holding.seller || "your portfolio";
  const sellerLine = input.holding.seller ? `to ${input.holding.seller}` : "";
  const totalFace = input.returns.reduce((s, r) => s + r.faceValueUsd, 0);
  const totalRefund = input.returns.reduce(
    (s, r) => s + (r.refundExpectedUsd ?? r.refundExpectedAuto),
    0
  );
  const purchaseDate = input.holding.purchaseDate || "[purchase date]";

  const lines: string[] = [];
  lines.push(`Subject: Return notice — ${tickerOrSeller} — ${input.returns.length} account${input.returns.length === 1 ? "" : "s"}`);
  lines.push("");
  lines.push(`Date: ${date}`);
  lines.push("");
  lines.push(`Per our purchase agreement dated ${purchaseDate}, we are returning the following accounts under the return window:`);
  lines.push("");
  for (const r of input.returns) {
    const flagDate = r.flaggedDate || r.createdAt.slice(0, 10);
    const daysNote =
      r.daysRemaining !== null
        ? r.daysRemaining < 0
          ? ` (${Math.abs(r.daysRemaining)}d past window — disputing in good faith)`
          : ` (${r.daysRemaining}d remaining in window)`
        : "";
    lines.push(
      `  - Row ${r.rowIndex}: ${RETURN_REASON_LABELS[r.reason]} — flagged ${flagDate}${daysNote}; face $${r.faceValueUsd.toFixed(2)}`
    );
  }
  lines.push("");
  lines.push(`Total face value: $${totalFace.toFixed(2)}`);
  lines.push(`Refund requested: $${totalRefund.toFixed(2)}`);
  lines.push("");
  lines.push("Please confirm receipt and process the refund / credit per the agreement terms.");
  lines.push("");
  lines.push("Account-level documentation available on request. Reply to this email with any required supporting docs and we will provide them under the existing data-sharing protocols.");
  lines.push("");
  if (input.operatorName) {
    lines.push(`Best,`);
    lines.push(input.operatorName);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CSV export — for seller-system upload
// ---------------------------------------------------------------------------

export function returnsCsv(returns: EnrichedReturn[], holdingsById: Map<string, HoldingForReturns>): string {
  const header = [
    "holding_id",
    "holding_ticker",
    "holding_seller",
    "row_index",
    "reason",
    "status",
    "flagged_date",
    "days_remaining",
    "face_value_usd",
    "refund_expected_usd",
    "refund_received_usd",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const r of returns) {
    const h = holdingsById.get(r.holdingId);
    lines.push(
      [
        r.holdingId,
        csvEscape(h?.ticker ?? ""),
        csvEscape(h?.seller ?? ""),
        String(r.rowIndex),
        r.reason,
        r.status,
        r.flaggedDate,
        r.daysRemaining !== null ? String(r.daysRemaining) : "",
        r.faceValueUsd.toFixed(2),
        (r.refundExpectedUsd ?? r.refundExpectedAuto).toFixed(2),
        r.refundReceivedUsd !== undefined ? r.refundReceivedUsd.toFixed(2) : "",
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

function formatUsdShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function newReturnId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
