"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { computeNextMove, type NextMove } from "@/lib/next-move";

// One-action card: "your single highest-impact next move." Sits at the
// very top of /app/today below OS setup so it's the first thing the
// operator sees after configuring. Pure heuristic over spine state —
// no LLM call, refreshes on storage events.

const SEVERITY_COLOR: Record<NextMove["severity"], string> = {
  critical: "var(--color-danger)",
  high: "var(--color-warn)",
  medium: "var(--color-accent)",
};

const PILLAR_ICON: Record<NextMove["pillar"], string> = {
  compliance: "§",
  returns: "⏎",
  capital: "$",
  pipeline: "→",
  tape: "◎",
};

export function NextMoveCard() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setHydrated(true);
    function onStorage() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const move = useMemo<NextMove | null>(() => {
    if (!hydrated) return null;
    return computeNextMove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  if (!hydrated || !move) return null;

  const color = SEVERITY_COLOR[move.severity];

  return (
    <section
      className="mb-6 rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-[18px] shrink-0"
          style={{ background: color, color: "var(--color-bg)" }}
          aria-hidden
        >
          {PILLAR_ICON[move.pillar]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="font-mono text-[10px] tracking-[0.18em] uppercase font-semibold"
              style={{ color }}
            >
              Your highest-impact next move
            </span>
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              {move.pillar} · {move.severity}
            </span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-[color:var(--color-fg)] tracking-tight">
            {move.label}
          </h2>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {move.why}
          </p>
          {move.impact && (
            <p className="mt-1 font-mono text-[11px]" style={{ color }}>
              {move.impact}
            </p>
          )}
        </div>
        <Link
          href={move.action.href}
          className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0 self-center"
          style={{ background: "var(--gradient-primary)" }}
        >
          {move.action.label}
        </Link>
      </div>
    </section>
  );
}
