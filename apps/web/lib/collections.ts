"use client";

/**
 * Monthly collections tracking for owned portfolio tapes. The portfolio board
 * stores one cumulative number per holding; this layer records each month's
 * servicer remittance and scores actual collections against a recovery model,
 * so a tape that's missing its forecast shows up before it's a surprise.
 *
 * Keyed by portfolio holding id. Stored in browser localStorage, separate from
 * the holdings store so the portfolio board needs no changes.
 */

export const COLLECTIONS_KEY = "tradeline.collections.v1";

/** One servicer remittance. `month` is YYYY-MM. */
export type Remittance = {
  id: string;
  month: string;
  amountUsd: number;
};

export type HoldingCollections = {
  holdingId: string;
  /** Expected lifetime recovery as a % of face value. */
  expectedRecoveryPct: number;
  /** Months over which that recovery is expected to come in. */
  workoutMonths: number;
  remittances: Remittance[];
};

/**
 * Per-asset-class default recovery model — illustrative starting points the
 * operator overrides per holding. Recovery % is of face value, lifetime.
 */
export const ASSET_MODEL: Record<
  string,
  { recoveryPct: number; months: number }
> = {
  "Credit card": { recoveryPct: 14, months: 30 },
  Auto: { recoveryPct: 35, months: 24 },
  "Junior mortgage": { recoveryPct: 45, months: 48 },
  Medical: { recoveryPct: 8, months: 36 },
  Commercial: { recoveryPct: 25, months: 36 },
  "Tax lien": { recoveryPct: 90, months: 24 },
  Specialty: { recoveryPct: 15, months: 36 },
};

export function defaultModel(assetClass: string): {
  recoveryPct: number;
  months: number;
} {
  return ASSET_MODEL[assetClass] || { recoveryPct: 15, months: 36 };
}

export function emptyCollections(
  holdingId: string,
  assetClass: string
): HoldingCollections {
  const m = defaultModel(assetClass);
  return {
    holdingId,
    expectedRecoveryPct: m.recoveryPct,
    workoutMonths: m.months,
    remittances: [],
  };
}

export function readCollections(): HoldingCollections[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HoldingCollections[]) : [];
  } catch {
    return [];
  }
}

export function writeCollections(all: HoldingCollections[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(all));
  } catch {}
}

export function collectionsFor(
  holdingId: string,
  assetClass: string,
  all: HoldingCollections[]
): HoldingCollections {
  return (
    all.find((c) => c.holdingId === holdingId) ||
    emptyCollections(holdingId, assetClass)
  );
}

export function totalCollected(hc: HoldingCollections): number {
  return hc.remittances.reduce((s, r) => s + (Number(r.amountUsd) || 0), 0);
}

export function hasRemittanceForMonth(
  hc: HoldingCollections,
  month: string
): boolean {
  return hc.remittances.some((r) => r.month === month);
}

/**
 * Fraction of lifetime recovery expected by `monthsElapsed`. Debt recovery is
 * front-loaded — the easy dollars come early — so the curve decelerates.
 */
export function expectedFraction(
  monthsElapsed: number,
  workoutMonths: number
): number {
  if (workoutMonths <= 0) return 1;
  const t = Math.min(1, Math.max(0, monthsElapsed / workoutMonths));
  return 1 - Math.pow(1 - t, 1.6);
}

export type RecoveryStatus = {
  lifetimeExpectedUsd: number;
  expectedNowUsd: number;
  actualUsd: number;
  deltaPct: number;
  label: "ahead" | "on-track" | "behind";
};

export function recoveryStatus(
  hc: HoldingCollections,
  faceValueUsd: number,
  monthsElapsed: number
): RecoveryStatus {
  const lifetimeExpectedUsd =
    (faceValueUsd * hc.expectedRecoveryPct) / 100;
  const expectedNowUsd =
    lifetimeExpectedUsd * expectedFraction(monthsElapsed, hc.workoutMonths);
  const actualUsd = totalCollected(hc);
  const deltaPct =
    expectedNowUsd > 0
      ? ((actualUsd - expectedNowUsd) / expectedNowUsd) * 100
      : 0;
  let label: RecoveryStatus["label"] = "on-track";
  if (deltaPct > 10) label = "ahead";
  else if (deltaPct < -10) label = "behind";
  return { lifetimeExpectedUsd, expectedNowUsd, actualUsd, deltaPct, label };
}
