// Operator concentration policy + breach detection.
//
// Operator declares max % exposure per dimension (state, vintage, asset
// class). At decode time, this module checks whether the tape's internal
// distribution breaches any of those limits. V1 is "tape-alone" — checks
// whether the new tape ALONE breaks the policy. V2 will join against the
// operator's existing book (Portfolio module) to check combined exposure.
//
// Even tape-alone is operationally valuable: it forces an operator to
// confront "we said max 25% CA but this tape is 31% CA" before they bid,
// rather than discovering it three weeks into placement.
//
// Storage: browser localStorage. Same pattern as license-map.

export const CONCENTRATION_POLICY_KEY = "tradeline.concentration.policy.v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConcentrationPolicy = {
  // Max % of total face value any single state may represent.
  // null = no limit on this dimension.
  maxPctPerState: number | null;
  // Max % per vintage year.
  maxPctPerVintage: number | null;
  // Max % per asset class.
  maxPctPerAssetClass: number | null;
  // Notes (free text)
  notes?: string;
  lastUpdated: string;
};

export type ConcentrationBreach = {
  dimension: "state" | "vintage" | "asset_class";
  key: string; // state code, vintage year, or asset class name
  pct: number; // observed %
  limit: number; // policy limit %
  faceValue: number;
  severity: "minor" | "moderate" | "severe";
};

export type ConcentrationReport = {
  policyConfigured: boolean;
  breaches: ConcentrationBreach[];
  // The biggest exposures per dimension regardless of breach — for context.
  topByDimension: {
    state: { key: string; pct: number; faceValue: number } | null;
    vintage: { key: string; pct: number; faceValue: number } | null;
    asset_class: { key: string; pct: number; faceValue: number } | null;
  };
};

// ---------------------------------------------------------------------------
// Defaults — sensible starting points the operator can override
// ---------------------------------------------------------------------------

export const DEFAULT_CONCENTRATION_POLICY: ConcentrationPolicy = {
  maxPctPerState: 25,
  maxPctPerVintage: 35,
  maxPctPerAssetClass: 60,
  lastUpdated: new Date(0).toISOString(),
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function readConcentrationPolicy(): ConcentrationPolicy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONCENTRATION_POLICY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ConcentrationPolicy;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeConcentrationPolicy(policy: ConcentrationPolicy): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sanitized: ConcentrationPolicy = {
      ...policy,
      lastUpdated: new Date().toISOString(),
    };
    window.localStorage.setItem(CONCENTRATION_POLICY_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Breach computation
// ---------------------------------------------------------------------------

function severityFor(pct: number, limit: number): ConcentrationBreach["severity"] {
  const overage = pct - limit;
  if (overage <= 2) return "minor";
  if (overage <= 10) return "moderate";
  return "severe";
}

export function computeConcentrationReport(
  policy: ConcentrationPolicy | null,
  aggregates: {
    totalFaceValue: number;
    stateDistribution: Array<{ state: string; count: number; faceValue: number }>;
    vintageDistribution: Array<{ period: string; count: number; faceValue: number }>;
    assetClassDistribution: Array<{ name: string; count: number; faceValue: number }>;
  }
): ConcentrationReport {
  const totalFace = aggregates.totalFaceValue;
  const breaches: ConcentrationBreach[] = [];

  const pctOf = (face: number): number => (totalFace > 0 ? (face / totalFace) * 100 : 0);

  const top = <T extends { faceValue: number }>(items: T[]): T | null =>
    items.length === 0 ? null : items.reduce((a, b) => (a.faceValue >= b.faceValue ? a : b));

  const topState = top(aggregates.stateDistribution);
  const topVintage = top(aggregates.vintageDistribution);
  const topAsset = top(aggregates.assetClassDistribution);

  if (policy) {
    if (policy.maxPctPerState !== null) {
      for (const e of aggregates.stateDistribution) {
        const pct = pctOf(e.faceValue);
        if (pct > policy.maxPctPerState) {
          breaches.push({
            dimension: "state",
            key: e.state,
            pct,
            limit: policy.maxPctPerState,
            faceValue: e.faceValue,
            severity: severityFor(pct, policy.maxPctPerState),
          });
        }
      }
    }
    if (policy.maxPctPerVintage !== null) {
      for (const e of aggregates.vintageDistribution) {
        const pct = pctOf(e.faceValue);
        if (pct > policy.maxPctPerVintage) {
          breaches.push({
            dimension: "vintage",
            key: e.period,
            pct,
            limit: policy.maxPctPerVintage,
            faceValue: e.faceValue,
            severity: severityFor(pct, policy.maxPctPerVintage),
          });
        }
      }
    }
    if (policy.maxPctPerAssetClass !== null) {
      for (const e of aggregates.assetClassDistribution) {
        const pct = pctOf(e.faceValue);
        if (pct > policy.maxPctPerAssetClass) {
          breaches.push({
            dimension: "asset_class",
            key: e.name,
            pct,
            limit: policy.maxPctPerAssetClass,
            faceValue: e.faceValue,
            severity: severityFor(pct, policy.maxPctPerAssetClass),
          });
        }
      }
    }
  }

  // Severe first, then moderate, then minor; within severity, biggest face first.
  const sevOrder: Record<ConcentrationBreach["severity"], number> = {
    severe: 0,
    moderate: 1,
    minor: 2,
  };
  breaches.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    if (s !== 0) return s;
    return b.faceValue - a.faceValue;
  });

  return {
    policyConfigured: !!policy,
    breaches,
    topByDimension: {
      state: topState
        ? { key: topState.state, pct: pctOf(topState.faceValue), faceValue: topState.faceValue }
        : null,
      vintage: topVintage
        ? { key: topVintage.period, pct: pctOf(topVintage.faceValue), faceValue: topVintage.faceValue }
        : null,
      asset_class: topAsset
        ? { key: topAsset.name, pct: pctOf(topAsset.faceValue), faceValue: topAsset.faceValue }
        : null,
    },
  };
}
