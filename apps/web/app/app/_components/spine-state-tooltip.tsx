"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  eventCountsByPillarPerDay,
  type Pillar,
  type PillarDailyCounts,
} from "@/lib/activity-log";

// Rich popover for the spine-state badge — per-pillar urgency counts +
// 7-day SVG sparklines of operator activity (events/day from the activity
// log). Surfaces "where things are happening" at a glance from any
// /app/* page without opening Today.

const PILLAR_ICON: Record<Pillar, string> = {
  tape: "◎",
  compliance: "§",
  capital: "$",
  returns: "⏎",
  portfolio: "◉",
  pipeline: "→",
};

const PILLAR_LABEL: Record<Pillar, string> = {
  tape: "Tape Copilot",
  compliance: "Compliance",
  capital: "Capital",
  returns: "Returns",
  portfolio: "Portfolio",
  pipeline: "Pipeline",
};

export type PillarUrgency = Partial<Record<Pillar, number>>;

export function SpineStateTooltip({
  urgencyByPillar,
}: {
  urgencyByPillar: PillarUrgency;
}) {
  const counts = useMemo<PillarDailyCounts[]>(
    () => eventCountsByPillarPerDay(7),
    []
  );

  // Order by activity descending so busiest pillars surface first
  const ordered = useMemo(() => {
    return counts
      .map((c) => ({
        ...c,
        total: c.buckets.reduce((s, n) => s + n, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [counts]);

  return (
    <div className="rounded-xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] shadow-xl p-3 w-[280px] z-50">
      <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] pb-2 border-b border-[color:var(--color-line)] flex items-center justify-between">
        <span>Spine activity · 7d</span>
        <Link
          href="/app/today"
          className="text-[color:var(--color-accent)] hover:underline normal-case tracking-normal text-[10px]"
        >
          Open Today →
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {ordered.map((row) => {
          const urgent = urgencyByPillar[row.pillar] ?? 0;
          return (
            <PillarRow
              key={row.pillar}
              pillar={row.pillar}
              urgent={urgent}
              buckets={row.buckets}
              total={row.total}
            />
          );
        })}
      </ul>
      <div className="mt-2 pt-2 border-t border-[color:var(--color-line)] font-mono text-[9px] text-[color:var(--color-fg-faint)] italic">
        Bars: events/day from your activity log. Urgent: items needing attention.
      </div>
    </div>
  );
}

function PillarRow({
  pillar,
  urgent,
  buckets,
  total,
}: {
  pillar: Pillar;
  urgent: number;
  buckets: number[];
  total: number;
}) {
  const max = Math.max(1, ...buckets);
  const urgentColor =
    urgent > 0 ? "var(--color-warn)" : "var(--color-fg-faint)";
  return (
    <li className="flex items-center gap-2">
      <span className="w-4 text-center font-mono text-[12px] text-[color:var(--color-accent)] shrink-0">
        {PILLAR_ICON[pillar]}
      </span>
      <span className="text-[11px] text-[color:var(--color-fg-dim)] w-[78px] truncate shrink-0">
        {PILLAR_LABEL[pillar]}
      </span>
      {/* Sparkline */}
      <svg
        viewBox="0 0 80 18"
        width="80"
        height="18"
        className="shrink-0"
        aria-label={`${total} events in last 7 days`}
      >
        {buckets.map((v, i) => {
          const h = Math.max(2, (v / max) * 14);
          const x = i * (80 / buckets.length);
          const w = 80 / buckets.length - 1.5;
          const y = 18 - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1}
              fill={v > 0 ? "var(--color-accent)" : "var(--color-line-strong)"}
              opacity={v > 0 ? 1 : 0.5}
            />
          );
        })}
      </svg>
      <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)] tabular-nums w-7 text-right shrink-0">
        {total > 0 ? total : "—"}
      </span>
      <span
        className="font-mono text-[10px] tabular-nums w-7 text-right shrink-0 font-semibold"
        style={{ color: urgentColor }}
        title={urgent > 0 ? `${urgent} urgent` : "no urgents"}
      >
        {urgent > 0 ? `!${urgent}` : "·"}
      </span>
    </li>
  );
}
