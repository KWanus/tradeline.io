"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCapitalState } from "@/lib/capital";
import {
  computeCapitalEnvelope,
  type AssetClassExposure,
  type CapitalEnvelopeReport,
  type DealFit,
  type DealFitFlag,
  type EnvelopeHolding,
} from "@/lib/capital-envelope";
import { type Deal } from "@/lib/pipeline";
import {
  readConcentrationPolicy,
  type ConcentrationPolicy,
} from "@/lib/tape-concentration-policy";
import {
  readEffectiveLicenseMap,
  type EffectiveLicenseMap,
} from "@/lib/tape-license-map";

// Local read of pipeline + portfolio from localStorage. We don't import
// the dedicated readers because the portfolio module's Holding type carries
// fields we don't need; this keeps the component decoupled.
const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";
const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

type RawHolding = {
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  assetClass?: string;
  vintageYear?: number;
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

const EMPTY_LICENSE: EffectiveLicenseMap = {
  source: "none",
  licensedStates: [],
  stateExpiries: new Map(),
  rawLicenseCount: 0,
};

export function BidEnvelopeSection() {
  const [hydrated, setHydrated] = useState(false);
  const [report, setReport] = useState<CapitalEnvelopeReport | null>(null);

  function recompute() {
    const capital = readCapitalState();
    const holdings: EnvelopeHolding[] = readJson<RawHolding>(PORTFOLIO_KEY).map((h) => ({
      faceValueUsd: Number(h.faceValueUsd) || 0,
      purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
      assetClass: h.assetClass || "Unspecified",
      vintageYear: Number(h.vintageYear) || undefined,
    }));
    const deals = readJson<Deal>(PIPELINE_KEY);
    const concentrationPolicy: ConcentrationPolicy | null = readConcentrationPolicy();
    const effectiveLicense: EffectiveLicenseMap =
      typeof window === "undefined" ? EMPTY_LICENSE : readEffectiveLicenseMap();

    setReport(
      computeCapitalEnvelope({
        totalCapital: capital.total,
        deployedCapital: capital.deployed,
        committedCapital: capital.committed,
        availableCapital: capital.available,
        ownedHoldings: holdings,
        pipelineDeals: deals,
        concentrationPolicy,
        effectiveLicense,
      })
    );
  }

  useEffect(() => {
    recompute();
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (
        e.key === null ||
        e.key === PORTFOLIO_KEY ||
        e.key === PIPELINE_KEY ||
        e.key === "tradeline.capital.config.v1" ||
        e.key === "tradeline.concentration.policy.v1" ||
        e.key === "tradeline.compliance.licenses.v1" ||
        e.key === "tradeline.license.policy.v1"
      ) {
        recompute();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!hydrated || !report) return null;

  // Top-of-page header block — "what you can safely bid this week"
  return (
    <section className="mb-8 space-y-4">
      <div
        className="rounded-2xl p-6"
        style={{
          background:
            "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
              What you can safely bid this week
            </div>
            <h2 className="mt-1 font-semibold text-2xl md:text-3xl tracking-tight text-[color:var(--color-fg)]">
              {report.activeDealsCount === 0
                ? "No active deals to evaluate."
                : `${report.deals.filter((d) => d.overallFit === "ok").length} of ${report.activeDealsCount} ready, ${report.deals.filter((d) => d.overallFit === "warn").length} need review, ${report.blockedBidIds.length} blocked.`}
            </h2>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              {report.headline}
            </p>
          </div>
          {report.activeDealsCount > 0 && (
            <Link
              href="/app/pipeline"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              Open pipeline →
            </Link>
          )}
        </div>

        {report.activeDealsCount > 0 && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <EnvelopeStat
              label="Available now"
              value={fmtUsd(report.availableCapital)}
              tone={report.availableCapital > 0 ? "ok" : "danger"}
            />
            <EnvelopeStat
              label="If you win all active"
              value={fmtUsd(report.hypotheticalIfWinAll)}
              tone="warn"
              sub={`${report.activeDealsCount} deals`}
            />
            <EnvelopeStat
              label="Post-win available"
              value={fmtUsd(report.availableAfterWinAll)}
              tone={report.willOverCommitIfWinAll ? "danger" : "ok"}
              sub={
                report.willOverCommitIfWinAll
                  ? `Over by ${fmtUsd(Math.abs(report.availableAfterWinAll))}`
                  : `Headroom maintained`
              }
            />
            <EnvelopeStat
              label="Safe bid pool"
              value={String(report.safeBidIds.length)}
              tone={report.safeBidIds.length > 0 ? "ok" : "warn"}
              sub={`Deals with no flags`}
            />
          </div>
        )}
      </div>

      {/* PER-DEAL FIT TABLE */}
      {report.activeDealsCount > 0 && (
        <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5 rounded-xl">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Per-deal fit
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            Capital, concentration, and license fit per active pipeline deal. Bid price assumed
            from <code>bidCentsPerDollar</code> or fallback to <code>askCentsPerDollar</code>.
          </p>
          <div className="mt-3 space-y-2">
            {report.deals.map((d) => (
              <DealRow key={d.dealId} d={d} />
            ))}
          </div>
        </div>
      )}

      {/* ASSET CLASS EXPOSURE */}
      {report.assetClassExposure.length > 0 && (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 rounded-xl">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Asset-class exposure — current vs. post-win projection
          </div>
          <div className="mt-3 space-y-2">
            {report.assetClassExposure.map((ace) => (
              <ExposureRow key={ace.assetClass} ace={ace} />
            ))}
          </div>
          {report.assetClassExposure.some((a) => a.breachesPolicy) && (
            <p className="mt-3 text-[11px] text-[color:var(--color-danger)] italic">
              ⚠ Post-win projection breaches your asset-class concentration policy. Configure at{" "}
              <Link href="/app/tools/tape" className="underline">/app/tools/tape</Link> (Concentration limits).
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function EnvelopeStat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger";
  sub?: string;
}) {
  const color =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "warn"
      ? "var(--color-warn)"
      : "var(--color-success)";
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

function fitBadgeStyle(fit: DealFitFlag): { bg: string; fg: string; label: string } {
  switch (fit) {
    case "ok":
      return { bg: "var(--color-success)", fg: "var(--color-bg)", label: "OK" };
    case "warn":
      return { bg: "var(--color-warn)", fg: "var(--color-bg)", label: "WARN" };
    case "block":
      return { bg: "var(--color-danger)", fg: "var(--color-bg)", label: "BLOCK" };
  }
}

function DealRow({ d }: { d: DealFit }) {
  const badge = fitBadgeStyle(d.overallFit);
  const borderColor =
    d.overallFit === "block"
      ? "var(--color-danger)"
      : d.overallFit === "warn"
      ? "var(--color-warn)"
      : "var(--color-line)";
  return (
    <div
      className="rounded border bg-[color:var(--color-bg)] p-3"
      style={{ borderColor }}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-[0.08em] font-semibold shrink-0"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
        <span className="font-mono text-[14px] text-[color:var(--color-accent)] shrink-0">
          {d.ticker || "—"}
        </span>
        <span className="text-[13px] text-[color:var(--color-fg)] flex-1 truncate min-w-0">
          {d.brokerName || "—"} · {d.assetClass}
        </span>
        <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
          face {fmtUsd(d.faceValueUsd)}
        </span>
        <span className="font-mono text-[12px] text-[color:var(--color-fg)] tabular-nums shrink-0">
          bid {d.assumedBidCentsPerDollar !== null
            ? `${d.assumedBidCentsPerDollar.toFixed(2)}¢/$ → ${fmtUsd(d.assumedBidDollars)}`
            : "—"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11.5px]">
        <FlagLine fit={d.capitalFit} label="Capital" note={d.capitalNote} />
        <FlagLine fit={d.concentrationFit} label="Concentration" note={d.concentrationNote} />
        {d.licenseHint && (
          <div className="md:col-span-2 text-[11px] text-[color:var(--color-fg-faint)] italic">
            License: {d.licenseHint}
          </div>
        )}
      </div>
    </div>
  );
}

function FlagLine({ fit, label, note }: { fit: DealFitFlag; label: string; note: string }) {
  const color =
    fit === "block"
      ? "var(--color-danger)"
      : fit === "warn"
      ? "var(--color-warn)"
      : "var(--color-success)";
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase shrink-0" style={{ color }}>
        {label}
      </span>
      <span className="text-[color:var(--color-fg-dim)]">{note}</span>
    </div>
  );
}

function ExposureRow({ ace }: { ace: AssetClassExposure }) {
  const tone = ace.breachesPolicy
    ? "var(--color-danger)"
    : ace.postWinPct > ace.currentPct
    ? "var(--color-warn)"
    : "var(--color-success)";
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[12px] text-[color:var(--color-fg)] w-32 shrink-0 truncate">
        {ace.assetClass}
      </span>
      <div className="flex-1 h-1.5 bg-[color:var(--color-bg-2)] overflow-hidden rounded-sm relative">
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: `${Math.min(100, ace.postWinPct)}%`, background: tone, opacity: 0.4 }}
        />
        <div
          className="absolute left-0 top-0 h-full rounded-sm"
          style={{ width: `${Math.min(100, ace.currentPct)}%`, background: tone }}
        />
      </div>
      <span className="font-mono text-[11px] text-[color:var(--color-fg-dim)] tabular-nums w-36 text-right shrink-0">
        {ace.currentPct.toFixed(0)}% → {ace.postWinPct.toFixed(0)}% · {fmtUsd(ace.postWinFaceUsd)}
      </span>
    </div>
  );
}
