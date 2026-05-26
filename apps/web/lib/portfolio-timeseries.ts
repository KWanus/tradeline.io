// Portfolio time-series — monthly cumulative cash actual vs model expected
// across the whole book. Pure aggregation over holdings + their
// HoldingCollections records (which carry the per-month remittance log).
//
// The chart consumer renders one series per holding-aggregate (actual)
// and one model series (expected by the front-loaded recovery curve).

import { expectedFraction, type HoldingCollections } from "./collections";

export type TimeSeriesHolding = {
  id: string;
  faceValueUsd: number;
  purchaseDate: string; // YYYY-MM-DD
};

export type TimeSeriesPoint = {
  month: string; // YYYY-MM
  // Cumulative actual = sum of remittances across all holdings with month ≤ this point.
  cumulativeActualUsd: number;
  // Cumulative model = sum of (lifetimeExpected × expectedFraction at this
  // many months since purchase) across all holdings.
  cumulativeModelUsd: number;
  // Total cumulative model = sum of lifetime expectations (the cap each
  // holding will eventually hit). Acts as the chart ceiling.
  cumulativeLifetimeCapUsd: number;
};

export type TimeSeriesReport = {
  points: TimeSeriesPoint[];
  // Most recent month visible in the chart
  latestMonth: string;
  // What month "today" sits in — for the vertical marker
  todayMonth: string;
  // Headline numbers for the chart legend / label
  latestActualUsd: number;
  latestModelUsd: number;
  performanceRatio: number; // latestActual / latestModel
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + n);
  return out;
}

function monthsBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + (fromISO.length === 7 ? "-01" : ""));
  const b = new Date(toISO + (toISO.length === 7 ? "-01" : ""));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

export function buildPortfolioTimeSeries(
  holdings: TimeSeriesHolding[],
  allCollections: HoldingCollections[],
  now: Date = new Date()
): TimeSeriesReport | null {
  if (holdings.length === 0) return null;

  // Build a lookup so we can pair each holding with its collections.
  const colByHolding = new Map<string, HoldingCollections>();
  for (const c of allCollections) colByHolding.set(c.holdingId, c);

  // Earliest purchase month across the book defines x-axis start.
  let earliest: Date | null = null;
  for (const h of holdings) {
    const d = new Date(h.purchaseDate);
    if (!Number.isNaN(d.getTime())) {
      if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
    }
  }
  if (!earliest) return null;

  // x-axis end = latest workout end across the book OR 6 months past today
  // (whichever is later) — give the operator forward visibility.
  let latestEnd: Date = addMonths(now, 6);
  for (const h of holdings) {
    const c = colByHolding.get(h.id);
    if (!c) continue;
    const purchase = new Date(h.purchaseDate);
    if (Number.isNaN(purchase.getTime())) continue;
    const workoutEnd = addMonths(purchase, c.workoutMonths || 36);
    if (workoutEnd.getTime() > latestEnd.getTime()) latestEnd = workoutEnd;
  }

  // Generate one point per month from earliest → latestEnd.
  const points: TimeSeriesPoint[] = [];
  let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(latestEnd.getFullYear(), latestEnd.getMonth(), 1);
  // Cap iterations so a misconfigured holding can't blow up the chart.
  const MAX_MONTHS = 120;
  let i = 0;
  while (cursor.getTime() <= end.getTime() && i < MAX_MONTHS) {
    const mk = monthKey(cursor);
    let cumActual = 0;
    let cumModel = 0;
    let cumCap = 0;
    for (const h of holdings) {
      const c = colByHolding.get(h.id);
      const lifetime =
        c && c.expectedRecoveryPct
          ? (h.faceValueUsd * c.expectedRecoveryPct) / 100
          : h.faceValueUsd * 0.15;
      cumCap += lifetime;
      // Cumulative actual = sum of remittance amounts with month ≤ mk
      if (c) {
        for (const r of c.remittances) {
          if (r.month <= mk) cumActual += Number(r.amountUsd) || 0;
        }
      }
      // Cumulative model at this point = lifetime × fraction(monthsSincePurchase)
      const monthsSince = monthsBetween(h.purchaseDate, `${mk}-01`);
      if (monthsSince >= 0) {
        const fraction = expectedFraction(monthsSince, c?.workoutMonths || 36);
        cumModel += lifetime * fraction;
      }
    }
    points.push({
      month: mk,
      cumulativeActualUsd: cumActual,
      cumulativeModelUsd: cumModel,
      cumulativeLifetimeCapUsd: cumCap,
    });
    cursor = addMonths(cursor, 1);
    i++;
  }

  const todayMonth = monthKey(now);
  const latest = points[points.length - 1];
  const latestActual = latest?.cumulativeActualUsd ?? 0;
  const latestModel = latest?.cumulativeModelUsd ?? 0;

  // Performance ratio at TODAY (not chart-end) for the headline
  const todayPoint =
    points.find((p) => p.month === todayMonth) ?? points[points.length - 1];
  const perf =
    todayPoint && todayPoint.cumulativeModelUsd > 0
      ? todayPoint.cumulativeActualUsd / todayPoint.cumulativeModelUsd
      : 0;

  return {
    points,
    latestMonth: latest?.month ?? todayMonth,
    todayMonth,
    latestActualUsd: latestActual,
    latestModelUsd: latestModel,
    performanceRatio: perf,
  };
}
