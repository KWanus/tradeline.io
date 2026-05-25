// Shared license schema + storage helpers.
//
// The /app/compliance page is the canonical surface for managing state
// licenses (debt-buyer / collection-agency licenses, bond amounts,
// expiration dates, surety carriers). Other surfaces — Tape Copilot's
// license-coverage card, the pre-send compliance shield in /api/send-
// outreach, the /app/today expiry banner — all READ from this same store.
//
// Storage: browser localStorage at `tradeline.compliance.licenses.v1`.
// When multi-tenant arrives the key becomes per-user.

export type LicenseType = "Debt buyer" | "Collection agency" | "Both";

export type License = {
  id: string;
  state: string; // 2-letter
  licenseType: LicenseType;
  licenseNumber: string;
  issueDate: string; // ISO date (YYYY-MM-DD) or ""
  expirationDate: string; // ISO date or ""
  bondAmountUsd: number;
  suretyCarrier: string;
  annualFeeUsd: number;
  notes: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export const COMPLIANCE_LICENSES_STORAGE_KEY = "tradeline.compliance.licenses.v1";

export type LicenseStatus = "active" | "expiring" | "expired";

// Days-to-expiry threshold for "expiring" status. Matches the existing
// compliance dashboard behavior; centralized so all consumers agree.
export const EXPIRING_THRESHOLD_DAYS = 90;

// Tighter threshold for the URGENT banner (today page, pre-send blocker
// warnings). Anything < this gets a red tone, not warn.
export const URGENT_EXPIRY_THRESHOLD_DAYS = 30;

export function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Infinity;
  const ms = d.getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function licenseStatus(l: License): LicenseStatus {
  const days = daysUntil(l.expirationDate);
  if (days < 0) return "expired";
  if (days <= EXPIRING_THRESHOLD_DAYS) return "expiring";
  return "active";
}

// Browser storage — gracefully no-ops in SSR.
export function readLicenses(): License[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLIANCE_LICENSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as License[]) : [];
  } catch {
    return [];
  }
}

export function writeLicenses(licenses: License[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      COMPLIANCE_LICENSES_STORAGE_KEY,
      JSON.stringify(licenses)
    );
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Action-applicability — what kinds of state-level actions does this
// license type permit? Maps to the compliance-check function's action types.
// ---------------------------------------------------------------------------

export type ComplianceActionType =
  // Sending outreach (buy-side prospecting OR collection contact)
  | "outreach_send"
  // Placing/buying a portfolio that includes accounts in this state
  | "bid_portfolio"
  // Placing accounts with a 3rd-party servicer in this state
  | "place_with_servicer"
  // Filing suit on an account in this state
  | "file_suit";

// Map each license type to which actions it covers. A state with only a
// "Debt buyer" license can BUY but cannot directly COLLECT (and vice versa).
// "Both" covers everything.
export function licenseTypeCoversAction(
  licenseType: LicenseType,
  action: ComplianceActionType
): boolean {
  if (licenseType === "Both") return true;
  if (licenseType === "Debt buyer") {
    return action === "bid_portfolio" || action === "place_with_servicer";
  }
  if (licenseType === "Collection agency") {
    return (
      action === "outreach_send" ||
      action === "file_suit" ||
      action === "place_with_servicer"
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// State-level lookups (used by compliance-check and banner consumers)
// ---------------------------------------------------------------------------

export type StateLicenseSummary = {
  state: string;
  licenses: License[]; // all licenses for this state
  hasActive: boolean;
  hasExpiring: boolean;
  hasExpired: boolean;
  // Earliest expiry date among non-expired licenses (the renewal cliff)
  earliestExpiringDays: number | null;
  // Which actions are covered, considering only non-expired licenses
  coveredActions: ComplianceActionType[];
};

export function summarizeStateLicenses(
  licenses: License[],
  state: string
): StateLicenseSummary {
  const code = state.trim().toUpperCase();
  const matched = licenses.filter((l) => l.state.toUpperCase() === code);
  const nonExpired = matched.filter((l) => licenseStatus(l) !== "expired");
  const expiringDays = nonExpired
    .map((l) => daysUntil(l.expirationDate))
    .filter((d) => Number.isFinite(d))
    .sort((a, b) => a - b);
  const coveredActionSet = new Set<ComplianceActionType>();
  for (const l of nonExpired) {
    for (const action of [
      "outreach_send",
      "bid_portfolio",
      "place_with_servicer",
      "file_suit",
    ] as ComplianceActionType[]) {
      if (licenseTypeCoversAction(l.licenseType, action)) coveredActionSet.add(action);
    }
  }
  return {
    state: code,
    licenses: matched,
    hasActive: matched.some((l) => licenseStatus(l) === "active"),
    hasExpiring: matched.some((l) => licenseStatus(l) === "expiring"),
    hasExpired: matched.some((l) => licenseStatus(l) === "expired"),
    earliestExpiringDays: expiringDays.length > 0 ? expiringDays[0] : null,
    coveredActions: Array.from(coveredActionSet),
  };
}

// Returns the list of states where the operator has at least one
// non-expired license. Used by tape-license-map for "covered states."
export function activeLicensedStates(licenses: License[]): string[] {
  const seen = new Set<string>();
  for (const l of licenses) {
    if (licenseStatus(l) !== "expired") {
      seen.add(l.state.toUpperCase());
    }
  }
  return Array.from(seen).sort();
}

// Returns the list of all states that ever had a license (including
// expired). Used by the expiry banner to surface "your XYZ license LAPSED"
// state-level urgency.
export function allEverLicensedStates(licenses: License[]): string[] {
  return Array.from(new Set(licenses.map((l) => l.state.toUpperCase()))).sort();
}

// Filter for licenses expiring within a window (used by today-page banner).
export function expiringWithinDays(licenses: License[], days: number): License[] {
  return licenses
    .filter((l) => {
      const d = daysUntil(l.expirationDate);
      return d >= 0 && d <= days;
    })
    .sort((a, b) => daysUntil(a.expirationDate) - daysUntil(b.expirationDate));
}

// Filter for already-expired licenses (the highest-severity surface).
export function expiredLicenses(licenses: License[]): License[] {
  return licenses
    .filter((l) => licenseStatus(l) === "expired")
    .sort((a, b) => daysUntil(a.expirationDate) - daysUntil(b.expirationDate));
}
