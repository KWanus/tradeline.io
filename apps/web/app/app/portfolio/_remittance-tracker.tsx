"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type HoldingCollections,
  collectionsFor,
  readCollections,
  recoveryStatus,
  totalCollected,
  writeCollections,
} from "@/lib/collections";
import { buildPortfolioTimeSeries } from "@/lib/portfolio-timeseries";
import { TimeSeriesChart } from "./_time-series-chart";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type Holding = {
  id: string;
  ticker: string;
  seller: string;
  servicer: string;
  assetClass: string;
  faceValueUsd: number;
  purchasePriceUsd: number;
  purchaseDate: string;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function monthsSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 30)));
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readHoldings(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((h) => ({
      id: String(h.id),
      ticker: String(h.ticker || ""),
      seller: String(h.seller || ""),
      servicer: String(h.servicer || ""),
      assetClass: String(h.assetClass || ""),
      faceValueUsd: Number(h.faceValueUsd) || 0,
      purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
      purchaseDate: String(h.purchaseDate || ""),
    }));
  } catch {
    return [];
  }
}

export function RemittanceTracker() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [collections, setCollections] = useState<HoldingCollections[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHoldings(readHoldings());
    setCollections(readCollections());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeCollections(collections);
  }, [collections, hydrated]);

  const mutate = (
    holdingId: string,
    assetClass: string,
    fn: (c: HoldingCollections) => HoldingCollections
  ) => {
    setCollections((prev) => {
      const base = collectionsFor(holdingId, assetClass, prev);
      return [...prev.filter((c) => c.holdingId !== holdingId), fn(base)];
    });
  };

  if (!hydrated) return null;
  if (holdings.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        Collections tracker
      </div>
      <h2 className="mt-2 font-serif text-3xl md:text-4xl tracking-tight text-[color:var(--color-fg)]">
        Is each tape beating its model?
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
        Log each month&rsquo;s servicer remittance. The tracker compares your
        actual collections to a front-loaded recovery model — so a tape falling
        behind shows up months before it&rsquo;s a write-off.
      </p>

      <div className="mt-5 space-y-4">
        {holdings.map((h) => (
          <HoldingCollectionsCard
            key={h.id}
            holding={h}
            collections={collectionsFor(h.id, h.assetClass, collections)}
            mutate={(fn) => mutate(h.id, h.assetClass, fn)}
          />
        ))}
      </div>
    </section>
  );
}

function HoldingCollectionsCard({
  holding,
  collections,
  mutate,
}: {
  holding: Holding;
  collections: HoldingCollections;
  mutate: (fn: (c: HoldingCollections) => HoldingCollections) => void;
}) {
  const [month, setMonth] = useState(thisMonth());
  const [amount, setAmount] = useState("");

  const monthsElapsed = useMemo(
    () => monthsSince(holding.purchaseDate),
    [holding.purchaseDate]
  );
  const status = useMemo(
    () => recoveryStatus(collections, holding.faceValueUsd, monthsElapsed),
    [collections, holding.faceValueUsd, monthsElapsed]
  );

  // Single-holding time-series for the per-card chart. Reuses the same
  // SVG component the portfolio dashboard uses for the book-wide curve.
  const tsReport = useMemo(
    () =>
      buildPortfolioTimeSeries(
        [
          {
            id: holding.id,
            faceValueUsd: holding.faceValueUsd,
            purchaseDate: holding.purchaseDate,
          },
        ],
        [collections]
      ),
    [holding.id, holding.faceValueUsd, holding.purchaseDate, collections]
  );

  const collected = totalCollected(collections);
  const netVsCost = collected - holding.purchasePriceUsd;

  const name =
    [holding.ticker, holding.seller].filter(Boolean).join(" · ") || "Tape";

  const sortedRemittances = useMemo(
    () => [...collections.remittances].sort((a, b) => b.month.localeCompare(a.month)),
    [collections.remittances]
  );

  const addRemittance = () => {
    const usd = Number(amount.replace(/[,$\s]/g, ""));
    if (!month || !Number.isFinite(usd) || usd <= 0) return;
    mutate((c) => ({
      ...c,
      // Replace any existing entry for the same month.
      remittances: [
        { id: newId(), month, amountUsd: usd },
        ...c.remittances.filter((r) => r.month !== month),
      ],
    }));
    setAmount("");
  };

  const removeRemittance = (id: string) =>
    mutate((c) => ({
      ...c,
      remittances: c.remittances.filter((r) => r.id !== id),
    }));

  const setModel = (field: "expectedRecoveryPct" | "workoutMonths", v: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return;
    mutate((c) => ({ ...c, [field]: n }));
  };

  const STATUS_TONE: Record<string, string> = {
    ahead: "text-[color:var(--color-success)]",
    "on-track": "text-[color:var(--color-fg-dim)]",
    behind: "text-[color:var(--color-danger)]",
  };
  const STATUS_LABEL: Record<string, string> = {
    ahead: "Ahead of model",
    "on-track": "On model",
    behind: "Behind model",
  };

  return (
    <article className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-xl md:text-2xl tracking-tight text-[color:var(--color-fg)]">
            {name}
          </h3>
          <div className="mt-0.5 font-mono text-[11px] tracking-wide text-[color:var(--color-fg-faint)]">
            {holding.assetClass || "—"} · face {formatUSD(holding.faceValueUsd)}{" "}
            · paid {formatUSD(holding.purchasePriceUsd)} · {monthsElapsed}mo
            held
          </div>
        </div>
        <span
          className={`font-mono text-[11px] tracking-[0.18em] uppercase ${STATUS_TONE[status.label]}`}
        >
          {STATUS_LABEL[status.label]} · {status.deltaPct >= 0 ? "+" : ""}
          {status.deltaPct.toFixed(0)}%
        </span>
      </div>

      {/* Recovery vs model */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Collected" value={formatUSD(collected)} />
        <Metric
          label="Model says (now)"
          value={formatUSD(status.expectedNowUsd)}
        />
        <Metric
          label="Model lifetime"
          value={formatUSD(status.lifetimeExpectedUsd)}
        />
        <Metric
          label="Net vs. cost"
          value={formatUSD(netVsCost)}
          tone={netVsCost >= 0 ? "ok" : "default"}
        />
      </div>

      {/* Model config */}
      <div className="mt-4 flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
            Expected recovery (% of face)
          </span>
          <input
            type="number"
            value={collections.expectedRecoveryPct}
            onChange={(e) => setModel("expectedRecoveryPct", e.target.value)}
            className="w-24 px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)]"
          />
        </label>
        <label className="block">
          <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
            Workout (months)
          </span>
          <input
            type="number"
            value={collections.workoutMonths}
            onChange={(e) => setModel("workoutMonths", e.target.value)}
            className="w-24 px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)]"
          />
        </label>
      </div>

      {/* Monthly remittance log */}
      <div className="mt-4">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          Monthly remittances
        </div>
        {sortedRemittances.length > 0 && (
          <ul className="mb-2 divide-y divide-[color:var(--color-line)] rounded-md border border-[color:var(--color-line)]">
            {sortedRemittances.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-3 py-2 text-[13px]"
              >
                <span className="font-mono text-[color:var(--color-fg)]">
                  {r.month}
                </span>
                <span className="text-[color:var(--color-fg-dim)]">
                  {formatUSD(r.amountUsd)}
                </span>
                <button
                  type="button"
                  onClick={() => removeRemittance(r.id)}
                  className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)]"
          />
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount collected"
            className="flex-1 min-w-[140px] px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)]"
          />
          <button
            type="button"
            onClick={addRemittance}
            disabled={!amount.trim()}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Log remittance
          </button>
        </div>
      </div>

      {/* Per-holding actual vs model curve — reuses portfolio dashboard's
         SVG chart but scoped to this single tape. Hidden until at least 2
         monthly points exist (one-month series isn't a curve). */}
      {tsReport && tsReport.points.length > 1 && (
        <div className="mt-5">
          <TimeSeriesChart report={tsReport} />
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok";
}) {
  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-3 py-3">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-[16px] ${
          tone === "ok"
            ? "text-[color:var(--color-success)]"
            : "text-[color:var(--color-fg)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
