"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_STORAGE_KEY,
  recentTapeDecodes,
  type RecentTapeDecode,
} from "@/lib/activity-log";

// Dense list of recent tape decodes (derived from the activity log).
// Surfaces the operator's evaluation history above the drop zone so they
// can remember what they've seen + the headline numbers. No "re-open"
// action — raw CSV isn't persisted by design; this is memory only.

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function relativeTime(iso: string, now: Date = new Date()): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "?";
  const diff = now.getTime() - ts;
  if (diff < 0) return "now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  return `${Math.floor(day / 30)}mo`;
}

const COLLAPSED_COUNT = 4;
const EXPANDED_COUNT = 10;

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "var(--color-success)";
    case "B":
      return "var(--color-accent)";
    case "C":
      return "var(--color-warn)";
    case "D":
      return "var(--color-warn)";
    case "F":
      return "var(--color-danger)";
    default:
      return "var(--color-fg-faint)";
  }
}

export function RecentDecodes() {
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

  const decodes = useMemo<RecentTapeDecode[]>(() => {
    if (!hydrated) return [];
    return recentTapeDecodes(EXPANDED_COUNT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  if (!hydrated || decodes.length === 0) return null;

  const visible = decodes.slice(0, expanded ? EXPANDED_COUNT : COLLAPSED_COUNT);
  const remaining = decodes.length - visible.length;

  return (
    <section className="mb-6 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Recent decodes
          </span>
          <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)]">
            ({decodes.length} in last 200 actions)
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.05em] uppercase text-[color:var(--color-fg-faint)]">
          Memory only · raw CSV not persisted by design
        </span>
      </div>
      <ul className="mt-3 space-y-1">
        {visible.map((d) => (
          <li
            key={d.id}
            className="flex items-baseline gap-2 font-mono text-[11.5px] py-1 border-b border-[color:var(--color-line)] last:border-0"
          >
            <span className="text-[color:var(--color-fg-faint)] tabular-nums w-8 shrink-0 text-right">
              {relativeTime(d.ts)}
            </span>
            <span className="text-[color:var(--color-accent)] flex-1 min-w-0 truncate" title={d.filename}>
              {d.filename}
            </span>
            <span className="text-[color:var(--color-fg)] tabular-nums shrink-0">
              {d.rowCount.toLocaleString()} accts
            </span>
            <span className="text-[color:var(--color-fg)] tabular-nums shrink-0">
              {fmtUsd(d.totalFaceValueUsd)}
            </span>
            {d.assetClass && (
              <span className="text-[color:var(--color-fg-dim)] shrink-0 truncate max-w-[10ch]">
                {d.assetClass}
              </span>
            )}
            {d.topState && (
              <span className="text-[color:var(--color-fg-dim)] shrink-0 w-7 text-right">
                {d.topState}
              </span>
            )}
            {d.schemaGrade && (
              <span
                className="font-semibold shrink-0 w-3 text-right"
                style={{ color: gradeColor(d.schemaGrade) }}
                title={`Schema grade ${d.schemaGrade}`}
              >
                {d.schemaGrade}
              </span>
            )}
          </li>
        ))}
      </ul>
      {(remaining > 0 || expanded) && (
        <div className="mt-2 pt-2 border-t border-[color:var(--color-line)]">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            {expanded ? "Collapse" : `Show ${remaining} more`}
          </button>
        </div>
      )}
    </section>
  );
}
