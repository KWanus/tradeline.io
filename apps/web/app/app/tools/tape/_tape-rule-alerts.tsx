"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CATEGORY_LABELS,
  matchRulesToTape,
  type RuleSeverity,
  type TapeRuleMatch,
} from "@/lib/state-rule-changelog";

const SEVERITY_COLOR: Record<RuleSeverity, string> = {
  critical: "var(--color-danger)",
  high: "var(--color-warn)",
  moderate: "var(--color-fg-dim)",
};

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function TapeRuleAlerts({
  stateDistribution,
  totalFaceValue,
  assetClasses,
}: {
  stateDistribution: Array<{ state: string; faceValue: number }>;
  totalFaceValue: number;
  assetClasses: string[];
}) {
  const matches = useMemo<TapeRuleMatch[]>(
    () =>
      matchRulesToTape({
        stateDistribution,
        totalFaceValue,
        assetClasses,
      }),
    [stateDistribution, totalFaceValue, assetClasses]
  );

  if (matches.length === 0) return null;

  const critical = matches.filter((m) => m.severity === "critical");
  const headlineColor = SEVERITY_COLOR[matches[0].severity];

  // Compute total affected face once for the headline.
  // For US rules and state rules we want the UNION of affected face, not sum.
  // We approximate by taking the MAX rule-affected face when any US rule is
  // present (since it covers the whole tape); otherwise sum overlapping
  // state buckets.
  const hasUsRule = matches.some((m) => m.state === "US");
  const totalAffected = hasUsRule
    ? totalFaceValue
    : Array.from(
        new Set(
          matches.flatMap((m) =>
            stateDistribution
              .filter((s) => m.matchingStates.includes(s.state.toUpperCase()))
              .map((s) => s.state.toUpperCase())
          )
        )
      ).reduce(
        (sum, state) =>
          sum +
          (stateDistribution.find((s) => s.state.toUpperCase() === state)?.faceValue ?? 0),
        0
      );
  const affectedPct =
    totalFaceValue > 0 ? (totalAffected / totalFaceValue) * 100 : 0;

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Step 2 · Rule-change alerts
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.05em] uppercase font-semibold"
            style={{ background: headlineColor, color: "var(--color-bg)" }}
          >
            {matches.length} relevant
            {critical.length > 0 ? ` · ${critical.length} critical` : ""}
          </span>
        </div>
        <Link
          href="/app/compliance#rule-changelog"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Full feed →
        </Link>
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] max-w-3xl">
        Recent regulatory changes that touch this tape&rsquo;s state/asset mix. Affecting{" "}
        <strong className="text-[color:var(--color-fg)]">
          {fmtUsd(totalAffected)} ({affectedPct.toFixed(1)}%)
        </strong>{" "}
        of face. Adjust your recovery model and bid accordingly.
      </p>

      <div className="mt-3 space-y-2">
        {matches.slice(0, 6).map((m) => (
          <AlertRow key={m.id} m={m} />
        ))}
        {matches.length > 6 && (
          <p className="text-[11px] text-[color:var(--color-fg-faint)] italic">
            +{matches.length - 6} more at /app/compliance#rule-changelog
          </p>
        )}
      </div>
    </section>
  );
}

function AlertRow({ m }: { m: TapeRuleMatch }) {
  const color = SEVERITY_COLOR[m.severity];
  return (
    <div
      className="rounded border bg-[color:var(--color-bg-1)] p-3"
      style={{ borderColor: color }}
    >
      <div className="flex items-baseline gap-3 flex-wrap">
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-[0.08em] font-semibold uppercase shrink-0"
          style={{ background: color, color: "var(--color-bg)" }}
        >
          {m.state} · {m.severity}
        </span>
        <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)] tracking-[0.05em] shrink-0">
          {CATEGORY_LABELS[m.category]}
        </span>
        <span className="text-[13px] text-[color:var(--color-fg)] font-medium flex-1 min-w-0">
          {m.title}
        </span>
        <span className="font-mono text-[12px] tabular-nums shrink-0" style={{ color }}>
          {fmtUsd(m.affectedFaceUsd)} ({m.affectedPctOfTape.toFixed(1)}%)
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-[color:var(--color-fg-dim)] leading-relaxed">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mr-2">
          Impact
        </span>
        {m.impact}
      </p>
      <div className="mt-1.5 flex items-center gap-3 flex-wrap font-mono text-[10px] text-[color:var(--color-fg-faint)]">
        <span>effective {m.dateEffective}</span>
        {m.matchingStates.length > 0 && (
          <span>
            applies to: {m.matchingStates.slice(0, 6).join(", ")}
            {m.matchingStates.length > 6 ? ` (+${m.matchingStates.length - 6})` : ""}
          </span>
        )}
        <a
          href={m.source}
          target="_blank"
          rel="noreferrer"
          className="text-[color:var(--color-accent)] hover:underline"
        >
          source →
        </a>
      </div>
    </div>
  );
}
