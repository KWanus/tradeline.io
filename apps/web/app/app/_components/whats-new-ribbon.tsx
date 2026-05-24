"use client";

import { useEffect, useState } from "react";

const KEY = "tradeline.last_visit.v1";
const MIN_GAP_MS = 5 * 60 * 1000; // 5 minutes — don't ribbon for tab-switches

function humanizeAgo(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}

/**
 * Friendly "welcome back, last visit X ago" ribbon. Hydrates from
 * localStorage on mount; if more than 5 minutes have elapsed since the
 * last open, surfaces a small line above the inbox so the operator
 * notices their absence. Otherwise renders nothing.
 *
 * Also stamps the visit timestamp on every mount, so a single tab open
 * advances the clock and back-to-back reloads don't re-trigger.
 */
export function WhatsNewRibbon({
  generatedAt,
}: {
  /** ISO timestamp of the radar snapshot — surfaced as a freshness cue. */
  generatedAt?: string;
}) {
  const [delta, setDelta] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const last = Number(raw);
        if (Number.isFinite(last)) {
          const ago = now - last;
          if (ago > MIN_GAP_MS) setDelta(humanizeAgo(ago));
        }
      }
      window.localStorage.setItem(KEY, String(now));
    } catch {}
  }, []);

  if (!delta) return null;

  const refreshedAt = generatedAt ? new Date(generatedAt) : null;
  const refreshedAgo = refreshedAt
    ? humanizeAgo(Date.now() - refreshedAt.getTime())
    : null;

  return (
    <div className="card mb-6 px-4 py-3 flex items-center gap-3 animate-fade-in-up">
      <span className="relative flex shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] glow" />
        <span className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] animate-ping opacity-40" />
      </span>
      <div className="text-[13px] leading-snug">
        <span className="text-[color:var(--color-fg)] font-medium">
          Welcome back.
        </span>{" "}
        <span className="text-[color:var(--color-fg-dim)]">
          Last visit {delta}
          {refreshedAgo ? ` — radar last refreshed ${refreshedAgo}` : ""}.
        </span>
      </div>
    </div>
  );
}
