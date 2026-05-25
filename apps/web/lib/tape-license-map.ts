// Operator license-map join.
//
// At decode time, intersect the tape's state distribution with the operator's
// declared license coverage. Output: how much face value is in states the
// operator CANNOT legally collect in, broken out by state. This is the
// difference between "this looks like a $5M tape" and "this looks like a
// $4.3M tape FOR YOU, because $700k of it is in TX/IL/CA where you lack
// the active debt-buyer license."
//
// V1 ships with a single concept: "states where you have all the licenses
// needed to legally collect third-party-purchased debt." V2 can split into
// debt-buyer vs. collector licenses, license-expiration dates, etc.
//
// Storage: browser localStorage. Same pattern as the pipeline storage in
// /app/pipeline. When multi-tenant arrives, the key becomes per-user.

import { SOL_CHART } from "./sol-chart";

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
};

// ---------------------------------------------------------------------------
// Storage
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
  policy: LicensePolicy | null,
  stateDistribution: Array<{ state: string; count: number; faceValue: number }>
): LicenseImpact {
  const totalFaceAnalyzed = stateDistribution.reduce((s, e) => s + e.faceValue, 0);

  if (!policy || policy.licensedStates.length === 0) {
    return {
      policyConfigured: !!policy,
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
    };
  }

  const licensed = new Set(policy.licensedStates);
  const uncoveredStates: LicenseImpact["uncoveredStates"] = [];
  const coveredStates: LicenseImpact["coveredStates"] = [];
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

  return {
    policyConfigured: true,
    totalFaceAnalyzed,
    coveredFaceValue,
    uncoveredFaceValue,
    coveredPct: totalFaceAnalyzed > 0 ? (coveredFaceValue / totalFaceAnalyzed) * 100 : 0,
    uncoveredPct: totalFaceAnalyzed > 0 ? (uncoveredFaceValue / totalFaceAnalyzed) * 100 : 0,
    uncoveredStates,
    coveredStates,
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
