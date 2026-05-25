"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  forecastPortfolio,
  type ForecastHolding,
  type HoldingForecast,
  type PortfolioForecast,
} from "@/lib/capital-forecast";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type RawHolding = {
  id?: string;
  ticker?: string;
  seller?: string;
  assetClass?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  purchaseDate?: string;
  cumulativeCollectedUsd?: number;
};

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtMultiple(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(2)}×`;
}

export function ReturnForecastSection() {
  const [hydrated, setHydrated] = useState(false);
  const [forecast, setForecast] = useState<PortfolioForecast | null>(null);

  function recompute() {
    const holdings: ForecastHolding[] = readJson<RawHolding>(PORTFOLIO_KEY)
      .map((h, i) => ({
        id: h.id ?? `h${i}`,
        ticker: h.ticker,
        seller: h.seller,
        assetClass: h.assetClass ?? "Unspecified",
        faceValueUsd: Number(h.faceValueUsd) || 0,
        purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
        purchaseDate: h.purchaseDate ?? "",
        cumulativeCollectedUsd:
          typeof h.cumulativeCollectedUsd === "number"
            ? h.cumulativeCollectedUsd
            : undefined,
      }))
      .filter((h) => h.purchasePriceUsd > 0 || h.faceValueUsd > 0);
    setForecast(forecastPortfolio(holdings));
  }

  useEffect(() => {
    recompute();
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === PORTFOLIO_KEY) recompute();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const grouped = useMemo(() => {
    if (!forecast) return null;
    const sorted = [...forecast.holdings].sort((a, b) => b.purchasePriceUsd - a.purchasePriceUsd);
    return sorted;
  }, [forecast]);

  if (!hydrated || !forecast) return null;
  if (forecast.holdings.length === 0) {
    return (
      <section className="mb-8 rounded-2xl border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Expected-return forecast
        </div>
        <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Record portfolio holdings at{" "}
          <Link href="/app/portfolio" className="underline hover:text-[color:var(--color-accent)]">
            /app/portfolio
          </Link>{" "}
          to see projected recovery + portfolio multiple + CAGR.
        </p>
      </section>
    );
  }

  const performanceTone =
    forecast.performanceRatio >= 1.1
      ? "var(--color-success)"
      : forecast.performanceRatio >= 0.9
      ? "var(--color-accent)"
      : forecast.performanceRatio > 0
      ? "var(--color-warn)"
      : "var(--color-fg-dim)";

  return (
    <section className="mb-8 space-y-4">
      <div className="rounded-2xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
              Expected-return forecast
            </div>
            <h2 className="mt-1 font-semibold text-2xl tracking-tight text-[color:var(--color-fg)]">
              {forecast.holdings.length} holdings ·{" "}
              {fmtMultiple(forecast.portfolioMultiple)} expected ·{" "}
              {fmtPct(forecast.portfolioCagrApprox, 1)} CAGR
            </h2>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              {forecast.headline}
            </p>
          </div>
          <Link
            href="/app/portfolio"
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition shrink-0"
          >
            Edit holdings →
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          <ForecastStat label="Total purchase" value={fmtUsd(forecast.totalPurchaseUsd)} />
          <ForecastStat
            label="Expected net recovery"
            value={fmtUsd(forecast.totalExpectedNetUsd)}
            tone="ok"
          />
          <ForecastStat
            label="Collected to date"
            value={fmtUsd(forecast.totalCollectedUsd)}
            sub={`Of ${fmtUsd(forecast.totalExpectedToDateUsd)} expected`}
          />
          <ForecastStat
            label="Performance"
            value={
              forecast.totalExpectedToDateUsd > 0
                ? fmtPct(forecast.performanceRatio, 0)
                : "—"
            }
            tone={
              forecast.performanceRatio >= 1.1
                ? "ok"
                : forecast.performanceRatio >= 0.9
                ? "default"
                : forecast.performanceRatio > 0
                ? "warn"
                : "default"
            }
            sub={`vs. expected-to-date`}
          />
          <ForecastStat
            label="Portfolio CAGR (approx)"
            value={fmtPct(forecast.portfolioCagrApprox, 1)}
            tone={
              forecast.portfolioCagrApprox >= 0.2
                ? "ok"
                : forecast.portfolioCagrApprox >= 0.1
                ? "default"
                : "warn"
            }
          />
        </div>

        {/* Status breakdown chips */}
        <div className="mt-4 flex items-center gap-2 flex-wrap font-mono text-[10px] tracking-[0.05em] uppercase">
          {forecast.countsByStatus.ahead > 0 && (
            <StatusChip tone="success">{forecast.countsByStatus.ahead} ahead</StatusChip>
          )}
          {forecast.countsByStatus.on_track > 0 && (
            <StatusChip tone="accent">{forecast.countsByStatus.on_track} on track</StatusChip>
          )}
          {forecast.countsByStatus.behind > 0 && (
            <StatusChip tone="warn">{forecast.countsByStatus.behind} behind</StatusChip>
          )}
          {forecast.countsByStatus.no_collection_data > 0 && (
            <StatusChip tone="muted">
              {forecast.countsByStatus.no_collection_data} no collection data
            </StatusChip>
          )}
        </div>
      </div>

      {/* PER-HOLDING TABLE */}
      <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Per-holding projection
        </div>
        <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
          Recovery projection per holding using asset-class defaults. Linear curve approximation
          for V1; real recovery is front-loaded S-shaped.
        </p>
        <div className="mt-3 space-y-1.5">
          {grouped!.map((h) => (
            <HoldingRow key={h.id} h={h} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ForecastStat({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger" | "default";
  sub?: string;
}) {
  const color =
    tone === "ok"
      ? "var(--color-success)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "danger"
      ? "var(--color-danger)"
      : "var(--color-fg)";
  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg)] px-3 py-3">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[18px]" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)]">{sub}</div>
      )}
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "accent" | "warn" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "accent"
      ? "var(--color-accent)"
      : tone === "warn"
      ? "var(--color-warn)"
      : "var(--color-fg-faint)";
  return (
    <span
      className="px-2 py-0.5 rounded-full border"
      style={{ color, borderColor: color }}
    >
      {children}
    </span>
  );
}

function HoldingRow({ h }: { h: HoldingForecast }) {
  const statusColor =
    h.status === "ahead"
      ? "var(--color-success)"
      : h.status === "on_track"
      ? "var(--color-accent)"
      : h.status === "behind"
      ? "var(--color-warn)"
      : "var(--color-fg-faint)";
  const statusLabel =
    h.status === "ahead"
      ? "AHEAD"
      : h.status === "on_track"
      ? "ON TRACK"
      : h.status === "behind"
      ? "BEHIND"
      : "—";
  const progressPct =
    h.expectedNetRecovery > 0
      ? Math.min(100, (h.actualCollectedToDate / h.expectedNetRecovery) * 100)
      : 0;
  const expectedProgressPct =
    h.expectedNetRecovery > 0
      ? Math.min(100, (h.expectedCollectedToDate / h.expectedNetRecovery) * 100)
      : 0;

  return (
    <div className="rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg)] p-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-[0.05em] font-semibold shrink-0"
          style={{ background: statusColor, color: "var(--color-bg)" }}
        >
          {statusLabel}
        </span>
        <span className="font-mono text-[13px] text-[color:var(--color-accent)] shrink-0">
          {h.ticker}
        </span>
        <span className="text-[12px] text-[color:var(--color-fg)] flex-1 truncate min-w-0">
          {h.assetClass} · {h.preset.label}
        </span>
        <span className="font-mono text-[11px] text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
          face {fmtUsd(h.faceValueUsd)} · paid {fmtUsd(h.purchasePriceUsd)}
        </span>
        <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: statusColor }}>
          {fmtMultiple(h.multipleOnCost)} · {fmtPct(h.cagrApprox, 1)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)] w-20 shrink-0">
          {h.ageDays}d / {Math.round(h.preset.workoutYears * 365)}d
        </span>
        <div className="flex-1 h-1.5 bg-[color:var(--color-bg-2)] overflow-hidden rounded-sm relative">
          {/* Expected progress (lighter) */}
          <div
            className="absolute left-0 top-0 h-full"
            style={{
              width: `${expectedProgressPct}%`,
              background: "var(--color-fg-faint)",
              opacity: 0.4,
            }}
          />
          {/* Actual progress (solid) */}
          <div
            className="absolute left-0 top-0 h-full rounded-sm"
            style={{ width: `${progressPct}%`, background: statusColor }}
          />
        </div>
        <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)] tabular-nums w-40 text-right shrink-0">
          collected {fmtUsd(h.actualCollectedToDate)} / {fmtUsd(h.expectedNetRecovery)} ({progressPct.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}
