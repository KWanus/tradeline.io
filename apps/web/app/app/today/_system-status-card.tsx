"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Live integration health on Today. Pulls /api/health (the same JSON that
 * powers the public /status page) and surfaces which services are armed —
 * Anthropic, Resend, cron — so the operator knows whether one-click send and
 * the daily briefing are actually wired before they rely on them.
 *
 * Collapses to a single green line when everything's healthy; expands to show
 * what's missing when it isn't.
 */

type Check = { name: string; ok: boolean; detail?: string };
type Health = {
  status: "ok" | "degraded" | "stale";
  checks: Check[];
  stats?: { snapshotAgeHours?: number | null; banks?: number };
};

const STATUS_TONE: Record<Health["status"], string> = {
  ok: "var(--color-success)",
  degraded: "var(--color-warn)",
  stale: "var(--color-danger)",
};

export function SystemStatusCard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Health) => {
        if (alive) {
          setHealth(d);
          // Auto-expand when something needs attention.
          if (d.status !== "ok") setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!health) return null;

  const tone = STATUS_TONE[health.status];
  const failing = health.checks.filter((c) => !c.ok);

  return (
    <section className="mb-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: tone }}
            aria-hidden
          />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            System
          </span>
          <span
            className="font-mono text-[10px] tracking-[0.18em] uppercase font-semibold"
            style={{ color: tone }}
          >
            {health.status}
          </span>
          {failing.length > 0 && (
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-fg-dim)]">
              · {failing.length} need{failing.length === 1 ? "s" : ""} attention
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {health.checks.map((c) => (
            <div key={c.name} className="flex items-center gap-2 text-[12px]">
              <span
                className={
                  c.ok
                    ? "text-[color:var(--color-success)]"
                    : "text-[color:var(--color-warn)]"
                }
              >
                {c.ok ? "✓" : "○"}
              </span>
              <span className="text-[color:var(--color-fg)] font-medium capitalize">
                {c.name}
              </span>
              {c.detail && (
                <span className="text-[color:var(--color-fg-faint)] truncate">
                  — {c.detail}
                </span>
              )}
            </div>
          ))}
          <Link
            href="/status"
            className="mt-1 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
          >
            Full status →
          </Link>
        </div>
      )}
    </section>
  );
}
