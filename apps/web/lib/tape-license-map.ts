// Operator license-map join.
//
// At decode time, intersect the tape's state distribution with the operator's
// declared license coverage. Output: how much face value is in states the
// operator CANNOT legally collect in, broken out by state.
//
// SOURCE OF TRUTH PRIORITY:
//   1. /app/compliance License[] records (the rich, canonical store with
//      per-license type, expiry, bond, surety) — read via `compliance-licenses`
//   2. The simple `tradeline.license.policy.v1` store (this module's own
//      fallback for ops who used the inline editor before configuring the
//      full compliance dashboard)
// Expired licenses in (1) are excluded; expiring-soon licenses are included
// but flagged in the impact warnings.

import { SOL_CHART } from "./sol-chart";
import {
  activeLicensedStates,
  daysUntil,
  expiringWithinDays,
  licenseStatus,
  readLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
  type License,
} from "./compliance-licenses";

export const LICENSE_POLICY_KEY = "tradeline.license.policy.v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LicensePolicy = {
  // 2-letter state codes where the operator is licensed to collect.
  // Empty array = operator declared "no licensed states" (rare; possibly
  // pre-license stage); null/undefined = policy not configured yet.
  licensedStates: string[];
  // ISO timestamp of last save.
  lastUpdated: string;
  // Operator notes (e.g., "TX, AL, SC don't require a license — included by default")
  notes?: string;
};

export type LicenseImpact = {
  policyConfigured: boolean;
  // Where the data came from — surfaces in the UI as a source indicator
  // ("4 active licenses from /app/compliance") so operators understand which
  // store is feeding the impact computation.
  source: "compliance_board" | "tape_simple_policy" | "none";
  totalFaceAnalyzed: number;
  coveredFaceValue: number;
  uncoveredFaceValue: number;
  coveredPct: number; // 0-100
  uncoveredPct: number; // 0-100
  // Uncovered states sorted desc by face value — what the operator most
  // needs to decide about.
  uncoveredStates: Array<{
    state: string;
    stateName: string;
    count: number;
    faceValue: number;
    facePct: number;
    notes?: string; // from SOL_CHART (e.g., "Strict licensing; new medical-debt rules 2024+.")
  }>;
  // States where the operator IS covered, for completeness.
  coveredStates: Array<{
    state: string;
    stateName: string;
    count: number;
    faceValue: number;
  }>;
  // States that are covered today but have a license expiring within the
  // urgent window. Surfacing this on every tape decode keeps renewal
  // visible at the moment of bid decision.
  coveredButExpiringSoon: Array<{
    state: string;
    daysToExpiry: number;
    faceValue: number;
  }>;
};

// ---------------------------------------------------------------------------
// Effective license map — unified shape derived from whichever store has
// the most authoritative data. The compliance board (rich License[] records
// with expiry tracking) wins; the simple LicensePolicy is a fallback.
// ---------------------------------------------------------------------------

export type EffectiveLicenseMap = {
  source: "compliance_board" | "tape_simple_policy" | "none";
  licensedStates: string[]; // 2-letter codes, sorted; excludes expired
  // Per-state expiry detail. Only populated when source = compliance_board.
  // Map key is 2-letter state code, value is min days-to-expiry across
  // licenses for that state.
  stateExpiries: Map<string, { daysToExpiry: number; isUrgent: boolean }>;
  // Pass-through metadata for the UI
  rawLicenseCount: number; // total non-expired licenses (if compliance_board)
  notes?: string; // from simple LicensePolicy when used
  lastUpdated?: string; // from simple LicensePolicy when used
};

export function readEffectiveLicenseMap(): EffectiveLicenseMap {
  // Prefer compliance board
  const licenses = readLicenses();
  if (licenses.length > 0) {
    const nonExpired = licenses.filter((l) => licenseStatus(l) !== "expired");
    const states = activeLicensedStates(licenses);
    const stateExpiries = new Map<string, { daysToExpiry: number; isUrgent: boolean }>();
    for (const l of nonExpired) {
      const days = daysUntil(l.expirationDate);
      if (!Number.isFinite(days)) continue;
      const code = l.state.toUpperCase();
      const existing = stateExpiries.get(code);
      if (!existing || days < existing.daysToExpiry) {
        stateExpiries.set(code, {
          daysToExpiry: days,
          isUrgent: days <= URGENT_EXPIRY_THRESHOLD_DAYS,
        });
      }
    }
    return {
      source: "compliance_board",
      licensedStates: states,
      stateExpiries,
      rawLicenseCount: nonExpired.length,
    };
  }
  // Fall back to simple LicensePolicy
  const policy = readLicensePolicy();
  if (policy && policy.licensedStates.length > 0) {
    return {
      source: "tape_simple_policy",
      licensedStates: [...policy.licensedStates].sort(),
      stateExpiries: new Map(),
      rawLicenseCount: policy.licensedStates.length,
      notes: policy.notes,
      lastUpdated: policy.lastUpdated,
    };
  }
  return {
    source: "none",
    licensedStates: [],
    stateExpiries: new Map(),
    rawLicenseCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Storage (simple LicensePolicy — fallback when compliance board is empty)
// ---------------------------------------------------------------------------

export function readLicensePolicy(): LicensePolicy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LICENSE_POLICY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as LicensePolicy).licensedStates)
    ) {
      return parsed as LicensePolicy;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLicensePolicy(policy: LicensePolicy): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sanitized: LicensePolicy = {
      ...policy,
      licensedStates: dedupeStates(policy.licensedStates),
      lastUpdated: new Date().toISOString(),
    };
    window.localStorage.setItem(LICENSE_POLICY_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

function dedupeStates(states: string[]): string[] {
  return Array.from(
    new Set(states.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)))
  ).sort();
}

// ---------------------------------------------------------------------------
// Impact computation
// ---------------------------------------------------------------------------

const STATE_NAME_BY_CODE: Record<string, string> = SOL_CHART.reduce(
  (acc, s) => ({ ...acc, [s.state]: s.name }),
  {} as Record<string, string>
);

const STATE_NOTES_BY_CODE: Record<string, string | undefined> = SOL_CHART.reduce(
  (acc, s) => ({ ...acc, [s.state]: s.notes }),
  {} as Record<string, string | undefined>
);

export function computeLicenseImpact(
  effective: EffectiveLicenseMap,
  stateDistribution: Array<{ state: string; count: number; faceValue: number }>
): LicenseImpact {
  const totalFaceAnalyzed = stateDistribution.reduce((s, e) => s + e.faceValue, 0);

  if (effective.source === "none" || effective.licensedStates.length === 0) {
    return {
      policyConfigured: effective.source !== "none",
      source: effective.source,
      totalFaceAnalyzed,
      coveredFaceValue: 0,
      uncoveredFaceValue: totalFaceAnalyzed,
      coveredPct: 0,
      uncoveredPct: 100,
      uncoveredStates: stateDistribution.map((s) => ({
        state: s.state,
        stateName: STATE_NAME_BY_CODE[s.state] ?? s.state,
        count: s.count,
        faceValue: s.faceValue,
        facePct: totalFaceAnalyzed > 0 ? (s.faceValue / totalFaceAnalyzed) * 100 : 0,
        notes: STATE_NOTES_BY_CODE[s.state],
      })),
      coveredStates: [],
      coveredButExpiringSoon: [],
    };
  }

  const licensed = new Set(effective.licensedStates);
  const uncoveredStates: LicenseImpact["uncoveredStates"] = [];
  const coveredStates: LicenseImpact["coveredStates"] = [];
  const coveredButExpiringSoon: LicenseImpact["coveredButExpiringSoon"] = [];
  let coveredFaceValue = 0;
  let uncoveredFaceValue = 0;

  for (const s of stateDistribution) {
    if (licensed.has(s.state)) {
      coveredFaceValue += s.faceValue;
      coveredStates.push({
        state: s.state,
        stateName: STATE_NAME_BY_CODE[s.state] ?? s.state,
        count: s.count,
        faceValue: s.faceValue,
      });
      // Surface expiry urgency per covered state (compliance_board only)
      const expiry = effective.stateExpiries.get(s.state);
      if (expiry && expiry.isUrgent) {
        coveredButExpiringSoon.push({
          state: s.state,
          daysToExpiry: expiry.daysToExpiry,
          faceValue: s.faceValue,
        });
      }
    } else {
      uncoveredFaceValue += s.faceValue;
      uncoveredStates.push({
        state: s.state,
        stateName: STATE_NAME_BY_CODE[s.state] ?? s.state,
        count: s.count,
        faceValue: s.faceValue,
        facePct: totalFaceAnalyzed > 0 ? (s.faceValue / totalFaceAnalyzed) * 100 : 0,
        notes: STATE_NOTES_BY_CODE[s.state],
      });
    }
  }

  uncoveredStates.sort((a, b) => b.faceValue - a.faceValue);
  coveredStates.sort((a, b) => b.faceValue - a.faceValue);
  coveredButExpiringSoon.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  return {
    policyConfigured: true,
    source: effective.source,
    totalFaceAnalyzed,
    coveredFaceValue,
    uncoveredFaceValue,
    coveredPct: totalFaceAnalyzed > 0 ? (coveredFaceValue / totalFaceAnalyzed) * 100 : 0,
    uncoveredPct: totalFaceAnalyzed > 0 ? (uncoveredFaceValue / totalFaceAnalyzed) * 100 : 0,
    uncoveredStates,
    coveredStates,
    coveredButExpiringSoon,
  };
}

// Helper: the full list of US states + DC for the policy editor checkbox grid.
export const ALL_US_STATES: Array<{ code: string; name: string; notes?: string }> = SOL_CHART.map(
  (s) => ({ code: s.state, name: s.name, notes: s.notes })
);

// Convenience: states where debt-buyer licensing is generally NOT required
// (per public licensing guides — Fitzgerald Advisors, Cornerstone Licensing,
// Harbor Compliance). Operator can use this as a starting "preselect" in
// the editor; THEY are responsible for verifying current requirements.
// Conservative list: only states with widely-documented no-license status.
export const NO_LICENSE_REQUIRED_STATES: ReadonlyArray<string> = [
  "AL", // Alabama — no statewide debt-buyer license
  "DE", // Delaware — no debt-buyer license
  "GA", // Georgia — no debt-buyer license (collection agency license different)
  "MS", // Mississippi — no debt-buyer license
  "MO", // Missouri — no debt-buyer license
  "OH", // Ohio — no debt-buyer license
  "OK", // Oklahoma — no debt-buyer license
  "SC", // South Carolina — no debt-buyer license
  "SD", // South Dakota — no debt-buyer license
  "TX", // Texas — bond/registration but no license
  "VA", // Virginia — no debt-buyer license
  "WY", // Wyoming — no debt-buyer license
];
