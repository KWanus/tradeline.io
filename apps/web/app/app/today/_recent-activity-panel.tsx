"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_STORAGE_KEY,
  readActivityLog,
  type ActivityEntry,
  type Pillar,
} from "@/lib/activity-log";

// Dense scrollable list of recent operator actions across all pillars.
// Surfaces the activity log the AI now consumes so the operator has
// visible parity with what their tutor / briefing knows about them.

const PILLAR_ICON: Record<Pillar, string> = {
  tape: "◎",
  compliance: "§",
  capital: "$",
  returns: "⏎",
  portfolio: "◉",
  pipeline: "→",
};

const PILLAR_COLOR: Record<Pillar, string> = {
  tape: "var(--color-accent)",
  compliance: "var(--color-warn)",
  capital: "var(--color-fg)",
  returns: "var(--color-warn)",
  portfolio: "var(--color-success)",
  pipeline: "var(--color-accent)",
};

function relativeTime(iso: string, now: Date = new Date()): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "?";
  const diffMs = now.getTime() - ts;
  if (diffMs < 0) return "now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  return `${mo}mo`;
}

const COLLAPSED_COUNT = 5;
const EXPANDED_COUNT = 20;
const WEEK_MS = 7 * 86_400_000;

type WeekRollup = {
  total: number;
  decodes: number;
  pipelineMoves: number;
  conversions: number;
  complianceTouches: number;
  capitalTouches: number;
  returnTouches: number;
  faceDecodedUsd: number;
};

function computeWeekRollup(log: ActivityEntry[], now: Date = new Date()): WeekRollup {
  const cutoff = now.getTime() - WEEK_MS;
  const r: WeekRollup = {
    total: 0,
    decodes: 0,
    pipelineMoves: 0,
    conversions: 0,
    complianceTouches: 0,
    capitalTouches: 0,
    returnTouches: 0,
    faceDecodedUsd: 0,
  };
  for (const e of log) {
    if (new Date(e.ts).getTime() < cutoff) continue;
    r.total++;
    if (e.type === "tape_decoded") {
      r.decodes++;
      r.faceDecodedUsd += Number(e.meta?.totalFaceValueUsd) || 0;
    } else if (e.pillar === "pipeline") {
      r.pipelineMoves++;
    } else if (e.type === "deal_converted_to_holding") {
      r.conversions++;
    } else if (e.pillar === "compliance") {
      r.complianceTouches++;
    } else if (e.pillar === "capital") {
      r.capitalTouches++;
    } else if (e.pillar === "returns") {
      r.returnTouches++;
    }
  }
  return r;
}

function fmtUsdCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

export function RecentActivityPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === ACTIVITY_STORAGE_KEY || e.key === null) {
        setRefreshKey((k) => k + 1);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const log = useMemo<ActivityEntry[]>(() => {
    if (!hydrated) return [];
    return readActivityLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  if (!hydrated || log.length === 0) return null;

  const visible = log.slice(0, expanded ? EXPANDED_COUNT : COLLAPSED_COUNT);
  const remaining = log.length - visible.length;
  const week = computeWeekRollup(log);
  const weekChips: { label: string; value: string; tone?: "accent" | "success" | "warn" }[] = [];
  if (week.decodes > 0) {
    weekChips.push({
      label: `${week.decodes} tape${week.decodes === 1 ? "" : "s"}`,
      value: fmtUsdCompact(week.faceDecodedUsd),
      tone: "accent",
    });
  }
  if (week.pipelineMoves > 0) {
    weekChips.push({ label: `${week.pipelineMoves} pipeline`, value: "moves" });
  }
  if (week.conversions > 0) {
    weekChips.push({
      label: `${week.conversions} won → held`,
      value: "converted",
      tone: "success",
    });
  }
  if (week.complianceTouches > 0) {
    weekChips.push({ label: `${week.complianceTouches} compliance`, value: "edits" });
  }
  if (week.capitalTouches > 0) {
    weekChips.push({ label: `${week.capitalTouches} capital`, value: "edits" });
  }
  if (week.returnTouches > 0) {
    weekChips.push({
      label: `${week.returnTouches} returns`,
      value: "actions",
      tone: "warn",
    });
  }

  return (
    <section className="mb-6 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Recent activity
          </span>
          <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)]">
            ({log.length} logged)
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.05em] uppercase text-[color:var(--color-fg-faint)]">
          Briefing + tutor see this
        </span>
      </div>
      {week.total > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)] mr-1">
            Last 7d
          </span>
          <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)]">
            {week.total} action{week.total === 1 ? "" : "s"}
          </span>
          {weekChips.map((c, i) => {
            const color =
              c.tone === "accent"
                ? "var(--color-accent)"
                : c.tone === "success"
                ? "var(--color-success)"
                : c.tone === "warn"
                ? "var(--color-warn)"
                : "var(--color-fg-dim)";
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-[color:var(--color-line)] rounded-sm font-mono text-[10px] tabular-nums"
                style={{ color }}
                title={`${c.label} ${c.value}`}
              >
                <span>{c.label}</span>
                <span className="text-[color:var(--color-fg-faint)]">{c.value}</span>
              </span>
            );
          })}
        </div>
      )}
      <ul className="mt-3 space-y-1">
        {visible.map((e) => (
          <li
            key={e.id}
            className="flex items-baseline gap-2 font-mono text-[11.5px] py-1 border-b border-[color:var(--color-line)] last:border-0"
          >
            <span
              className="w-4 text-center shrink-0"
              style={{ color: PILLAR_COLOR[e.pillar] }}
              title={e.pillar}
            >
              {PILLAR_ICON[e.pillar]}
            </span>
            <span className="text-[color:var(--color-fg-faint)] tabular-nums w-8 shrink-0 text-right">
              {relativeTime(e.ts)}
            </span>
            <span className="text-[color:var(--color-fg-dim)] flex-1 min-w-0 truncate" title={e.summary}>
              {e.summary}
            </span>
            {e.deepLink && (
              <Link
                href={e.deepLink}
                className="text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)] transition shrink-0"
                aria-label={`Open ${e.deepLink}`}
                title={e.deepLink}
              >
                →
              </Link>
            )}
          </li>
        ))}
      </ul>
      {(remaining > 0 || expanded) && (
        <div className="mt-2 pt-2 border-t border-[color:var(--color-line)] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            {expanded ? "Collapse" : `Show ${Math.min(remaining, EXPANDED_COUNT - COLLAPSED_COUNT)} more`}
          </button>
          {expanded && log.length > EXPANDED_COUNT && (
            <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)] italic">
              {log.length - EXPANDED_COUNT} older entries still in storage (briefing context uses 15 most recent).
            </span>
          )}
        </div>
      )}
    </section>
  );
}
