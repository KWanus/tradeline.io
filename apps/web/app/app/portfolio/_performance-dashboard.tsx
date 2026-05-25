"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCollections, type HoldingCollections } from "@/lib/collections";
import {
  buildPerformanceReport,
  type AnalyticsHolding,
  type GroupRollup,
  type PortfolioPerformanceReport,
} from "@/lib/portfolio-analytics";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type RawHolding = {
  id?: string;
  ticker?: string;
  seller?: string;
  servicer?: string;
  assetClass?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  vintageYear?: number;
  purchaseDate?: string;
};

function readHoldings(): AnalyticsHolding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((h: RawHolding, i: number) => ({
      id: String(h.id ?? `h${i}`),
      ticker: String(h.ticker ?? ""),
      seller: String(h.seller ?? ""),
      servicer: String(h.servicer ?? ""),
      assetClass: String(h.assetClass ?? ""),
      faceValueUsd: Number(h.faceValueUsd) || 0,
      purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
      vintageYear: Number(h.vintageYear) || undefined,
      purchaseDate: String(h.purchaseDate ?? ""),
    }));
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

function fmtCents(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}¢/$`;
}

export function PerformanceDashboard() {
  const [hydrated, setHydrated] = useState(false);
  const [report, setReport] = useState<PortfolioPerformanceReport | null>(null);

  function recompute() {
    const holdings = readHoldings();
    const collections: HoldingCollections[] = readCollections();
    setReport(buildPerformanceReport(holdings, collections));
  }

  useEffect(() => {
    recompute();
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === PORTFOLIO_KEY || e.key === "tradeline.collections.v1") {
        recompute();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!hydrated || !report) return null;
  if (report.enriched.length === 0) {
    return null; // existing portfolio board renders its own empty-state CTA
  }

  const perfTone =
    report.portfolioPerformanceRatio >= 1.1
      ? "var(--color-success)"
      : report.portfolioPerformanceRatio >= 0.9
      ? "var(--color-accent)"
      : report.portfolioPerformanceRatio > 0
      ? "var(--color-warn)"
      : "var(--color-fg-dim)";

  return (
    <section className="mb-8 space-y-4">
      {/* HEADLINE */}
      <div
        className="rounded-2xl p-6"
        style={{
          background:
            "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
              Performance dashboard
            </div>
            <h2 className="mt-1 font-semibold text-2xl md:text-3xl tracking-tight text-[color:var(--color-fg)]">
              {report.enriched.length} holdings · {fmtCents(report.realizedCentsPerDollar)} realized
              · {fmtUsd(report.forecast90DayUsd)} next 90d
            </h2>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              {report.headline}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Total face" value={fmtUsd(report.totalFaceUsd)} />
          <Stat label="Total purchase" value={fmtUsd(report.totalPurchaseUsd)} />
          <Stat
            label="Collected to date"
            value={fmtUsd(report.totalCollectedUsd)}
            sub={`Of ${fmtUsd(report.totalExpectedNowUsd)} expected`}
            tone="ok"
          />
          <Stat
            label="Performance"
            value={
              report.totalExpectedNowUsd > 0
                ? fmtPct(report.portfolioPerformanceRatio, 0)
                : "—"
            }
            sub="vs. model"
            tone={
              report.portfolioPerformanceRatio >= 1.1
                ? "ok"
                : report.portfolioPerformanceRatio >= 0.9
                ? "default"
                : report.portfolioPerformanceRatio > 0
                ? "warn"
                : "default"
            }
          />
          <Stat
            label="90-day forecast"
            value={fmtUsd(report.forecast90DayUsd)}
            sub={
              report.velocityLastMonthUsd > 0
                ? `${fmtUsd(report.velocityLastMonthUsd)} last month`
                : "no last-month data"
            }
            tone="accent"
          />
        </div>

        {/* Status chips */}
        <div className="mt-4 flex items-center gap-2 flex-wrap font-mono text-[10px] tracking-[0.05em] uppercase">
          {report.countsByStatus.ahead > 0 && (
            <Chip tone="success">{report.countsByStatus.ahead} ahead</Chip>
          )}
          {report.countsByStatus["on-track"] > 0 && (
            <Chip tone="accent">{report.countsByStatus["on-track"]} on track</Chip>
          )}
          {report.countsByStatus.behind > 0 && (
            <Chip tone="warn">{report.countsByStatus.behind} behind</Chip>
          )}
        </div>
      </div>

      {/* TOP / WORST HIGHLIGHTS */}
      {(report.topPerformer || report.worstUnderperformer) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.topPerformer && (
            <HighlightCard
              tone="success"
              label="Top performer"
              ticker={report.topPerformer.holding.ticker || report.topPerformer.holding.seller || "—"}
              assetClass={report.topPerformer.holding.assetClass}
              deltaPct={report.topPerformer.status.deltaPct}
              collected={report.topPerformer.totalCollectedUsd}
              expected={report.topPerformer.status.expectedNowUsd}
            />
          )}
          {report.worstUnderperformer && (
            <HighlightCard
              tone="warn"
              label="Worst underperformer"
              ticker={report.worstUnderperformer.holding.ticker || report.worstUnderperformer.holding.seller || "—"}
              assetClass={report.worstUnderperformer.holding.assetClass}
              deltaPct={report.worstUnderperformer.status.deltaPct}
              collected={report.worstUnderperformer.totalCollectedUsd}
              expected={report.worstUnderperformer.status.expectedNowUsd}
            />
          )}
        </div>
      )}

      {/* PER-SERVICER */}
      {report.byServicer.length > 0 && (
        <GroupTable
          label="By servicer"
          subtitle="Sorted by realized cents-per-purchase-dollar — your best-performing servicer first."
          rollups={report.byServicer}
        />
      )}

      {/* PER-VINTAGE */}
      {report.byVintage.length > 0 && (
        <GroupTable
          label="By vintage year"
          subtitle="Older vintages should show higher realized cents — they've had more time to collect."
          rollups={report.byVintage}
        />
      )}

      {/* PER-ASSET CLASS */}
      {report.byAssetClass.length > 0 && (
        <GroupTable
          label="By asset class"
          subtitle="Which paper types are returning capital fastest in your book?"
          rollups={report.byAssetClass}
        />
      )}

      <p className="text-[10px] font-mono text-[color:var(--color-fg-faint)] italic">
        Performance comparisons use the front-loaded recovery model from{" "}
        <Link href="/app/learn#portfolio" className="underline hover:text-[color:var(--color-accent)]">
          lib/collections.ts
        </Link>
        . 90-day forecast = conservative min of (model-implied next 3mo, recent-velocity × 3),
        capped by remaining lifetime expectation per holding.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "danger" | "accent" | "default";
}) {
  const color =
    tone === "ok"
      ? "var(--color-success)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "danger"
      ? "var(--color-danger)"
      : tone === "accent"
      ? "var(--color-accent)"
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

function Chip({
  tone,
  children,
}: {
  tone: "success" | "accent" | "warn";
  children: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "accent"
      ? "var(--color-accent)"
      : "var(--color-warn)";
  return (
    <span
      className="px-2 py-0.5 rounded-full border"
      style={{ color, borderColor: color }}
    >
      {children}
    </span>
  );
}

function HighlightCard({
  tone,
  label,
  ticker,
  assetClass,
  deltaPct,
  collected,
  expected,
}: {
  tone: "success" | "warn";
  label: string;
  ticker: string;
  assetClass: string;
  deltaPct: number;
  collected: number;
  expected: number;
}) {
  const color = tone === "success" ? "var(--color-success)" : "var(--color-warn)";
  return (
    <div className="rounded-xl border bg-[color:var(--color-bg-1)] p-4" style={{ borderColor: color }}>
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color }}>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[18px] text-[color:var(--color-accent)]">
          {ticker}
        </span>
        <span className="text-[13px] text-[color:var(--color-fg-dim)]">{assetClass}</span>
        <span className="font-mono text-[14px] ml-auto" style={{ color }}>
          {deltaPct >= 0 ? "+" : ""}
          {deltaPct.toFixed(0)}% vs. model
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-[color:var(--color-fg-dim)] font-mono">
        Collected {fmtUsd(collected)} · model said {fmtUsd(expected)}
      </p>
    </div>
  );
}

function GroupTable({
  label,
  subtitle,
  rollups,
}: {
  label: string;
  subtitle: string;
  rollups: GroupRollup[];
}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">{subtitle}</p>
      <div className="mt-3 space-y-1.5">
        {rollups.map((r) => {
          const perfTone =
            r.performanceRatio >= 1.1
              ? "var(--color-success)"
              : r.performanceRatio >= 0.9
              ? "var(--color-accent)"
              : r.performanceRatio > 0
              ? "var(--color-warn)"
              : "var(--color-fg-faint)";
          return (
            <div
              key={r.key}
              className="flex items-baseline gap-3 font-mono text-[12px] py-1.5 border-b border-[color:var(--color-line)] last:border-0"
            >
              <span className="text-[color:var(--color-accent)] w-36 shrink-0 truncate">
                {r.key}
              </span>
              <span className="text-[color:var(--color-fg-dim)] shrink-0 w-12 tabular-nums">
                {r.holdingCount}h
              </span>
              <span className="text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
                face {fmtUsd(r.totalFaceUsd)}
              </span>
              <span className="text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
                paid {fmtUsd(r.totalPurchaseUsd)}
              </span>
              <span className="text-[color:var(--color-fg)] tabular-nums shrink-0 flex-1">
                collected {fmtUsd(r.totalCollectedUsd)} ({fmtCents(r.realizedCentsPerDollar)})
              </span>
              <span className="tabular-nums shrink-0 w-24 text-right" style={{ color: perfTone }}>
                {r.totalExpectedNowUsd > 0 ? `${(r.performanceRatio * 100).toFixed(0)}%` : "—"} model
              </span>
              <span className="text-[color:var(--color-accent)] tabular-nums shrink-0 w-20 text-right">
                {fmtUsd(r.forecast90DayUsd)} 90d
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
