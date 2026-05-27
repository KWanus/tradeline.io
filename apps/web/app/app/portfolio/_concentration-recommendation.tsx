"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeConcentrationRecommendations,
  type ConcentrationRecommendation,
  type ConcentrationRecommendationReport,
} from "@/lib/concentration-recommendation";
import { readConcentrationPolicy } from "@/lib/tape-concentration-policy";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";
const POLICY_KEY = "tradeline.concentration.policy.v1";

type RawHolding = {
  faceValueUsd?: number;
  assetClass?: string;
  vintageYear?: number;
};

type Holding = {
  faceValueUsd: number;
  assetClass: string;
  vintageYear?: number;
};

function readHoldings(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((h: RawHolding) => ({
      faceValueUsd: Number(h.faceValueUsd) || 0,
      assetClass: String(h.assetClass ?? "Unspecified"),
      vintageYear: Number(h.vintageYear) || undefined,
    }));
  } catch {
    return [];
  }
}

export function ConcentrationRecommendation() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === PORTFOLIO_KEY || e.key === POLICY_KEY) {
        setRefreshKey((k) => k + 1);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const report = useMemo<ConcentrationRecommendationReport | null>(() => {
    if (!hydrated) return null;
    const holdings = readHoldings();
    const policy = readConcentrationPolicy();
    return computeConcentrationRecommendations({ holdings, policy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  if (!hydrated || !report || !report.policyConfigured) return null;
  // Auto-hide when nothing to suggest — operator's book is already
  // within policy on every dimension we check.
  if (report.recommendations.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            Concentration policy — book has drifted
          </div>
          <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug max-w-2xl">
            {report.headline} Either revise the policy upward to match how the
            book actually buys, or tighten future bidding to bring the dimension
            back inside the cap. Policy is set in Tape Copilot &rarr; Concentration
            limits.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {report.recommendations.map((r) => (
          <RecRow key={`${r.dimension}:${r.key}`} rec={r} />
        ))}
      </ul>
    </section>
  );
}

function RecRow({ rec }: { rec: ConcentrationRecommendation }) {
  const tone =
    rec.kind === "revise_policy"
      ? "var(--color-warn)"
      : "var(--color-fg-dim)";
  return (
    <li
      className="rounded border bg-[color:var(--color-bg)] p-3"
      style={{ borderColor: tone }}
    >
      <div className="flex items-baseline gap-3 flex-wrap font-mono text-[12px]">
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-[0.08em] uppercase shrink-0"
          style={{ background: tone, color: "var(--color-bg)" }}
        >
          {rec.kind === "revise_policy" ? "Revise policy" : "Tighten bidding"}
        </span>
        <span className="text-[color:var(--color-fg-dim)] w-28 shrink-0">
          {rec.dimension.replace("_", " ")}
        </span>
        <span className="text-[color:var(--color-accent)] font-semibold">{rec.key}</span>
        <span className="text-[color:var(--color-fg)] tabular-nums">
          {rec.currentPct.toFixed(0)}% (cap {rec.policyLimit}%)
        </span>
        <span className="text-[color:var(--color-fg-faint)] tabular-nums shrink-0">
          +{rec.overagePts.toFixed(1)}pts
        </span>
        {rec.suggestedNewLimitPct !== undefined && (
          <span
            className="ml-auto font-mono text-[11px]"
            style={{ color: tone }}
          >
            suggest cap → {rec.suggestedNewLimitPct}%
          </span>
        )}
      </div>
      <p className="mt-2 text-[12.5px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {rec.message}
      </p>
    </li>
  );
}
