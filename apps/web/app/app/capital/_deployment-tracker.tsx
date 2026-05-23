"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type CapitalState,
  readCapitalState,
  readTotalCapital,
  writeTotalCapital,
} from "@/lib/capital";

function formatUSD(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

const EMPTY: CapitalState = {
  configured: false,
  total: 0,
  deployed: 0,
  committed: 0,
  available: 0,
};

export function CapitalDeploymentTracker() {
  const [state, setState] = useState<CapitalState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");

  const refresh = () => setState(readCapitalState());

  useEffect(() => {
    refresh();
    const t = readTotalCapital();
    setDraft(t > 0 ? String(t) : "");
    setHydrated(true);
  }, []);

  const saveTotal = () => {
    const n = Number(draft.replace(/[,$\s]/g, ""));
    writeTotalCapital(Number.isFinite(n) && n > 0 ? n : 0);
    refresh();
  };

  const { deployedPct, committedPct, availablePct } = useMemo(() => {
    const base = state.total > 0 ? state.total : 1;
    const d = Math.min(100, (state.deployed / base) * 100);
    const c = Math.min(100 - d, (state.committed / base) * 100);
    return {
      deployedPct: d,
      committedPct: c,
      availablePct: Math.max(0, 100 - d - c),
    };
  }, [state]);

  const overCommitted = state.configured && state.available < 0;

  if (!hydrated) return null;

  return (
    <section className="mb-10 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-7">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Capital tracker
          </div>
          <h2 className="mt-1 font-serif italic text-2xl md:text-3xl tracking-tight text-[color:var(--color-fg)]">
            What you can still bid.
          </h2>
        </div>
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
              Total capital
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="250000"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-36 px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[14px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <button
            type="button"
            onClick={saveTotal}
            className="btn-primary"
          >
            Set
          </button>
        </div>
      </div>

      {!state.configured ? (
        <p className="mt-4 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Enter the cash you have to deploy. The tracker then subtracts what you
          have spent on owned tapes and what is tied up in live bids — so you
          always know your real number before you bid again.
        </p>
      ) : (
        <>
          <div className="mt-5 h-3 rounded-full overflow-hidden bg-[color:var(--color-bg-soft)] flex">
            <div
              className="h-full"
              style={{
                width: `${deployedPct}%`,
                background: "var(--color-fg-dim)",
              }}
              title={`Deployed ${formatUSD(state.deployed)}`}
            />
            <div
              className="h-full"
              style={{
                width: `${committedPct}%`,
                background: "var(--color-warn)",
              }}
              title={`Committed ${formatUSD(state.committed)}`}
            />
            <div
              className="h-full"
              style={{
                width: `${availablePct}%`,
                background: "var(--gradient-primary)",
              }}
              title={`Available ${formatUSD(state.available)}`}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total capital" value={formatUSD(state.total)} />
            <Stat
              label="Deployed · owned tapes"
              value={formatUSD(state.deployed)}
            />
            <Stat
              label="Committed · live bids"
              value={formatUSD(state.committed)}
              tone="warn"
            />
            <Stat
              label="Available to bid"
              value={formatUSD(state.available)}
              tone={overCommitted ? "danger" : "ok"}
            />
          </div>

          {overCommitted ? (
            <p className="mt-4 rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft,transparent)] px-4 py-3 text-[13px] text-[color:var(--color-danger)] leading-relaxed">
              Over-committed by {formatUSD(Math.abs(state.available))}. Your
              owned tapes plus live bids exceed your capital. Win every open bid
              and you cannot fund them — drop a bid or raise capital.
            </p>
          ) : (
            <p className="mt-4 text-[12px] text-[color:var(--color-fg-faint)] leading-relaxed">
              Deployed = sum of purchase prices in{" "}
              <span className="font-mono">/app/portfolio</span>. Committed = live
              bids on <span className="font-mono">/app/pipeline</span> deals in
              the Bidding stage. Refresh after editing either page.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const color =
    tone === "ok"
      ? "text-[color:var(--color-success)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : tone === "danger"
          ? "text-[color:var(--color-danger)]"
          : "text-[color:var(--color-fg)]";
  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-3 py-3">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-[18px] ${color}`}>{value}</div>
    </div>
  );
}
