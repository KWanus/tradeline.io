"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_STORAGE_KEY,
  recommendLicensesFromDecodes,
  type RecommendedLicense,
} from "@/lib/activity-log";
import {
  activeLicensedStates,
  readLicenses,
} from "@/lib/compliance-licenses";
import { SOL_CHART } from "@/lib/sol-chart";

// Activity-driven license recommendations. Reads operator's decode
// history from the activity log, groups by top state, filters out
// already-licensed states, surfaces unlicensed states where the
// operator has evaluated meaningful face value.
//
// Complementary to LicenseGapPanel (which shows generic state buckets);
// this one says "here's where YOUR deal flow is taking you."

const STATE_NAMES: Record<string, string> = Object.fromEntries(
  SOL_CHART.map((s) => [s.state, s.name])
);

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function LicenseRecommendationPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (
        e.key === null ||
        e.key === ACTIVITY_STORAGE_KEY ||
        e.key === "tradeline.compliance.licenses.v1"
      ) {
        setRefreshKey((k) => k + 1);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const recommendations = useMemo<RecommendedLicense[]>(() => {
    if (!hydrated) return [];
    const licensed = activeLicensedStates(readLicenses());
    return recommendLicensesFromDecodes({ licensedStates: licensed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  if (!hydrated || recommendations.length === 0) return null;

  const totalUnlicensedFace = recommendations.reduce((s, r) => s + r.totalFaceUsd, 0);

  return (
    <section className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5 rounded-xl">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-accent)]">
            Where your deal flow is going
          </div>
          <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug max-w-2xl">
            States that show up in your recent tape decodes but aren&rsquo;t in
            your license map. Ranked by total face you&rsquo;ve evaluated —{" "}
            <strong className="text-[color:var(--color-fg)]">
              {fmtUsd(totalUnlicensedFace)}
            </strong>{" "}
            across {recommendations.length} state{recommendations.length === 1 ? "" : "s"}{" "}
            in the last 90 days. Personalized to your activity (not a generic
            recommendation).
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {recommendations.map((r) => {
          const stateName = STATE_NAMES[r.state] || r.state;
          const daysAgo = Math.floor(
            (Date.now() - new Date(r.mostRecentDecode).getTime()) / 86_400_000
          );
          return (
            <li
              key={r.state}
              className="flex items-baseline gap-3 font-mono text-[12px] py-2 border-b border-[color:var(--color-line)] last:border-0"
            >
              <span
                className="font-semibold text-[14px] text-[color:var(--color-accent)] w-10 shrink-0"
                title={stateName}
              >
                {r.state}
              </span>
              <span className="text-[color:var(--color-fg-dim)] flex-1 min-w-0 truncate">
                {stateName}
              </span>
              <span className="text-[color:var(--color-fg)] tabular-nums shrink-0">
                {r.decodeCount} tape{r.decodeCount === 1 ? "" : "s"} evaluated
              </span>
              <span className="text-[color:var(--color-fg)] tabular-nums shrink-0">
                {fmtUsd(r.totalFaceUsd)} face
              </span>
              <span className="text-[color:var(--color-fg-faint)] text-[10px] tabular-nums shrink-0 w-12 text-right">
                {daysAgo}d ago
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-[color:var(--color-fg-faint)] italic">
        Threshold: only states with ≥$100k of evaluated face in the last 90 days appear here.
        Adjust your license map at the top of this page to suppress recommendations once you&rsquo;ve
        added a license.
      </p>
    </section>
  );
}
