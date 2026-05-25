"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  computeCompSet,
  type CompMatch,
  type CompSetConfidence,
  type CompSetReport,
} from "@/lib/bid-comp-set";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";
const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

type RawHolding = {
  id?: string;
  assetClass?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  vintageYear?: number;
  purchaseDate?: string;
  cumulativeCollectedUsd?: number;
};

type RawDeal = {
  id?: string;
  assetClass?: string;
  faceValueUsd?: number;
  bidCentsPerDollar?: number;
  askCentsPerDollar?: number;
  stage?: string;
};

const ASSET_CLASSES = [
  "Credit card",
  "Auto",
  "Junior mortgage",
  "Medical",
  "Commercial",
  "Tax lien",
  "Specialty",
  "Student",
  "Telecom",
];

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

function fmtCents(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}¢/$`;
}

const CONFIDENCE_COLOR: Record<CompSetConfidence, string> = {
  cold_start: "var(--color-fg-faint)",
  low: "var(--color-warn)",
  medium: "var(--color-accent)",
  high: "var(--color-success)",
};

const CONFIDENCE_LABEL: Record<CompSetConfidence, string> = {
  cold_start: "Cold start",
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function CompSetPanel() {
  const params = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [assetClass, setAssetClass] = useState<string>("Credit card");
  const [faceValue, setFaceValue] = useState<number>(5_000_000);
  const [vintageYear, setVintageYear] = useState<string>("");
  const [report, setReport] = useState<CompSetReport | null>(null);

  // Deep-link support: ?face=X&assetClass=Y&vintage=Z
  useEffect(() => {
    const f = params?.get("face");
    if (f) {
      const n = Number(f);
      if (Number.isFinite(n) && n > 0) setFaceValue(Math.min(n, 100_000_000));
    }
    const ac = params?.get("assetClass");
    if (ac) {
      // Match against known classes; fall back to first if not found
      const matched = ASSET_CLASSES.find((c) => c.toLowerCase() === ac.toLowerCase());
      setAssetClass(matched ?? ac);
    }
    const vy = params?.get("vintage");
    if (vy) setVintageYear(vy);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute when inputs change
  useEffect(() => {
    if (!hydrated) return;
    const holdings = readJson<RawHolding>(PORTFOLIO_KEY).map((h, i) => ({
      id: h.id ?? `h${i}`,
      assetClass: h.assetClass ?? "Unspecified",
      faceValueUsd: Number(h.faceValueUsd) || 0,
      purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
      vintageYear: Number(h.vintageYear) || undefined,
      purchaseDate: h.purchaseDate ?? "",
      cumulativeCollectedUsd:
        typeof h.cumulativeCollectedUsd === "number"
          ? h.cumulativeCollectedUsd
          : undefined,
    }));
    const deals = readJson<RawDeal>(PIPELINE_KEY).map((d, i) => ({
      id: d.id ?? `d${i}`,
      assetClass: d.assetClass ?? "Unspecified",
      faceValueUsd: Number(d.faceValueUsd) || 0,
      bidCentsPerDollar:
        typeof d.bidCentsPerDollar === "number" ? d.bidCentsPerDollar : undefined,
      askCentsPerDollar:
        typeof d.askCentsPerDollar === "number" ? d.askCentsPerDollar : undefined,
      stage: (d.stage as RawDeal["stage"]) ?? "sourced",
    }));
    const r = computeCompSet(
      {
        assetClass,
        faceValueUsd: faceValue,
        vintageYear: vintageYear ? Number(vintageYear) || undefined : undefined,
      },
      holdings,
      deals as Parameters<typeof computeCompSet>[2]
    );
    setReport(r);
  }, [hydrated, assetClass, faceValue, vintageYear]);

  if (!hydrated || !report) return null;

  const confColor = CONFIDENCE_COLOR[report.confidence];
  const confLabel = CONFIDENCE_LABEL[report.confidence];

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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
                Your comp set
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.05em] uppercase"
                style={{ background: confColor, color: "var(--color-bg)" }}
              >
                {confLabel} · n={report.totalMatches}
              </span>
            </div>
            <h2 className="mt-2 font-semibold text-2xl tracking-tight text-[color:var(--color-fg)]">
              {report.recommendedBidCentsPerDollar !== null && report.recommendedBidRange
                ? `Recommended bid: ${fmtCents(report.recommendedBidCentsPerDollar)} (range ${report.recommendedBidRange.low.toFixed(2)}–${report.recommendedBidRange.high.toFixed(2)})`
                : "Insufficient history — use industry defaults below"}
            </h2>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              {report.headline}
            </p>
          </div>
        </div>

        {/* Tape inputs */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SmallSelect
            label="Asset class"
            value={assetClass}
            onChange={setAssetClass}
            options={ASSET_CLASSES}
          />
          <SmallInput
            label="Face value (USD)"
            type="number"
            value={String(faceValue)}
            onChange={(v) => {
              const n = Number(v);
              if (Number.isFinite(n) && n >= 0) setFaceValue(n);
            }}
          />
          <SmallInput
            label="Vintage year (optional)"
            type="number"
            value={vintageYear}
            onChange={setVintageYear}
            placeholder="e.g. 2024"
          />
        </div>

        {/* Recommended bid range visual */}
        {report.bidStats && report.recommendedBidRange && (
          <div className="mt-5 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg)] p-4 rounded-lg">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              Bid distribution from your comps
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
              <RangeStat label="Min" value={fmtCents(report.bidStats.min)} />
              <RangeStat
                label="25th %ile (low)"
                value={fmtCents(report.bidStats.p25)}
                tone="ok"
              />
              <RangeStat
                label="Median"
                value={fmtCents(report.bidStats.median)}
                tone="accent"
                emphasized
              />
              <RangeStat
                label="75th %ile (high)"
                value={fmtCents(report.bidStats.p75)}
                tone="warn"
              />
              <RangeStat label="Max" value={fmtCents(report.bidStats.max)} />
            </div>
          </div>
        )}

        {/* Win rate + realized */}
        {(report.winRate !== null || report.realizedStats) && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {report.winRate !== null && (
              <Headline
                label="Win rate"
                value={`${(report.winRate * 100).toFixed(0)}%`}
                sub={`${Math.round(report.winRate * report.winRateN)}/${report.winRateN} decisive`}
              />
            )}
            {report.realizedStats && (
              <>
                <Headline
                  label="Realized multiple (median)"
                  value={`${report.realizedStats.medianMultiple.toFixed(2)}×`}
                  sub={`${report.realizedStats.holdingsWithData} holdings with collection data`}
                />
                <Headline
                  label="Realized CAGR (median)"
                  value={fmtPct(report.realizedStats.medianCagr, 0)}
                  sub="approximation"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* MATCH TABLE */}
      {report.matches.length > 0 && (
        <details className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 rounded-xl">
          <summary className="cursor-pointer font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)] transition list-none">
            ▸ View matched comps ({report.matches.length})
          </summary>
          <div className="mt-3 space-y-1.5">
            {report.matches.slice(0, 20).map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
            {report.matches.length > 20 && (
              <p className="text-[11px] text-[color:var(--color-fg-faint)] italic">
                Showing top 20 of {report.matches.length} matches by similarity.
              </p>
            )}
          </div>
        </details>
      )}

      {/* Cold-start guidance */}
      {report.confidence === "cold_start" && (
        <div className="rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-4">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            Build comp depth
          </div>
          <p className="mt-2 text-[12.5px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Comp-set pricing replaces industry defaults with YOUR realized history once you have
            at least 3 similar comps. Today: log every deal outcome in{" "}
            <Link href="/app/pipeline" className="underline hover:text-[color:var(--color-accent)]">
              /app/pipeline
            </Link>{" "}
            (set bidCentsPerDollar + final stage), and record purchases in{" "}
            <Link href="/app/portfolio" className="underline hover:text-[color:var(--color-accent)]">
              /app/portfolio
            </Link>{" "}
            (purchase price + cumulative collected). Every entry sharpens the model.
          </p>
        </div>
      )}
    </section>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-line)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function SmallSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-line)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeStat({
  label,
  value,
  tone = "default",
  emphasized = false,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "accent" | "default";
  emphasized?: boolean;
}) {
  const color =
    tone === "ok"
      ? "var(--color-success)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "accent"
      ? "var(--color-accent)"
      : "var(--color-fg)";
  return (
    <div className={`rounded px-2 py-2 ${emphasized ? "border" : ""}`}
      style={emphasized ? { borderColor: color } : undefined}
    >
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono ${emphasized ? "text-[16px] font-semibold" : "text-[13px]"}`}
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function Headline({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg)] px-3 py-3">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[18px] text-[color:var(--color-fg)]">
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)]">{sub}</div>
      )}
    </div>
  );
}

function MatchRow({ m }: { m: CompMatch }) {
  const outcomeColor =
    m.outcome === "won"
      ? "var(--color-success)"
      : m.outcome === "lost"
      ? "var(--color-danger)"
      : m.outcome === "walked"
      ? "var(--color-warn)"
      : m.outcome === "owned"
      ? "var(--color-accent)"
      : "var(--color-fg-faint)";
  return (
    <div className="flex items-baseline gap-3 font-mono text-[11.5px] py-1.5 border-b border-[color:var(--color-line)] last:border-0">
      <span
        className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-[0.08em] uppercase shrink-0"
        style={{ background: outcomeColor, color: "var(--color-bg)" }}
      >
        {m.outcome}
      </span>
      <span className="text-[color:var(--color-fg-dim)] w-20 shrink-0 truncate">
        {m.assetClass}
      </span>
      <span className="text-[color:var(--color-fg-dim)] flex-1">
        face {fmtUsd(m.faceValueUsd)}
        {m.vintageYear && ` · vintage ${m.vintageYear}`}
      </span>
      {m.bidOrPriceCentsPerDollar !== null && (
        <span className="text-[color:var(--color-accent)] tabular-nums shrink-0">
          {fmtCents(m.bidOrPriceCentsPerDollar)}
        </span>
      )}
      {m.realizedMultiple !== null && (
        <span className="text-[color:var(--color-success)] tabular-nums shrink-0">
          → {m.realizedMultiple.toFixed(2)}×
          {m.ageYears !== null && ` (${m.ageYears.toFixed(1)}y)`}
        </span>
      )}
      <span className="text-[color:var(--color-fg-faint)] tabular-nums shrink-0 w-12 text-right">
        {m.similarityScore}
      </span>
    </div>
  );
}
