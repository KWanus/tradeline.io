"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  analyze,
  ASSET_DEFAULTS,
  computeBid,
  suggestDefaults,
  type AssetDefaults,
  type TapeAggregates,
} from "@/lib/tape-analyzer";

// Pipeline storage — must match apps/web/app/app/pipeline/_pipeline-board.tsx
const PIPELINE_STORAGE_KEY = "tradeline.pipeline.deals.v1";

type PipelineDealMinimal = {
  id: string;
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  askCentsPerDollar?: number;
  bidCentsPerDollar?: number;
  stage:
    | "sourced"
    | "reviewing"
    | "underwriting"
    | "bidding"
    | "won"
    | "lost"
    | "walked";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

const SAMPLE_TAPE = [
  "account_balance,state,charge_off_date,asset_type,first_name,last_name,phone,ssn",
  "5234.12,GA,2024-09-15,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "1822.55,VA,2024-11-02,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "12450.00,NY,2024-07-20,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "2701.18,CA,2024-08-08,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "938.40,TX,2024-12-11,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "6712.99,FL,2024-10-28,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "4350.00,GA,2024-09-29,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "2199.45,NC,2024-07-04,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "8900.50,MD,2024-11-19,credit card,Sample,Sample,000-000-0000,000-00-0000",
  "1450.00,VA,2024-08-22,credit card,Sample,Sample,000-000-0000,000-00-0000",
].join("\n");

export function TapeUploader() {
  const [filename, setFilename] = useState<string | null>(null);
  const [aggregates, setAggregates] = useState<TapeAggregates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetIdx, setPresetIdx] = useState(0);
  const [overrides, setOverrides] = useState<AssetDefaults | null>(null);
  const [savedDealId, setSavedDealId] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [brokerName, setBrokerName] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [askInput, setAskInput] = useState("");

  const preset: AssetDefaults = overrides ?? ASSET_DEFAULTS[presetIdx];

  const bid = useMemo(() => {
    if (!aggregates) return null;
    return computeBid({
      totalFaceValue: aggregates.totalFaceValue,
      recoveryPct: preset.recoveryPct,
      workoutYears: preset.workoutYears,
      servicerFeePct: preset.servicerFeePct,
      irrPct: preset.irrPct,
    });
  }, [aggregates, preset]);

  function processText(text: string, source: string) {
    try {
      setError(null);
      const result = analyze(text);
      setAggregates(result);
      setFilename(source);
      // Suggest defaults from detected asset class
      const top = result.assetClassDistribution[0]?.name;
      if (top) {
        const suggested = suggestDefaults(top);
        const idx = ASSET_DEFAULTS.findIndex((d) => d.label === suggested.label);
        if (idx >= 0) setPresetIdx(idx);
        setOverrides(null);
      }
    } catch (err) {
      setError((err as Error).message || "Failed to parse tape");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      processText(text, file.name);
    };
    reader.readAsText(file);
  }

  function loadSample() {
    processText(SAMPLE_TAPE, "demo-tape.csv (10 sample rows)");
  }

  function clear() {
    setAggregates(null);
    setFilename(null);
    setError(null);
    setOverrides(null);
    setSavedDealId(null);
    setShowSaveForm(false);
    setBrokerName("");
    setTickerInput("");
    setAskInput("");
  }

  function saveToPipeline() {
    if (!aggregates || !bid) return;
    const now = new Date().toISOString();
    const topAsset = aggregates.assetClassDistribution[0]?.name || preset.label;
    // Map tape asset label onto a pipeline asset class enum (loose match)
    const pipelineAsset = mapToPipelineAssetClass(topAsset);
    const summary = [
      `Tape eval: ${aggregates.rowCount.toLocaleString()} accounts, ${formatUSD(aggregates.totalFaceValue)} face.`,
      aggregates.stateDistribution.length > 0
        ? `Top states: ${aggregates.stateDistribution
            .slice(0, 3)
            .map((s) => s.state)
            .join("/")}.`
        : "",
      aggregates.vintageDistribution.length > 0
        ? `Vintages: ${aggregates.vintageDistribution.map((v) => v.period).slice(-3).join(", ")}.`
        : "",
      `Disciplined bid (${preset.label}): ${formatUSD(bid.disciplinedBid)} (${bid.disciplinedBidCentsPerDollar.toFixed(2)}¢/$).`,
      `Max bid: ${formatUSD(bid.maxBid)} (${bid.maxBidCentsPerDollar.toFixed(2)}¢/$).`,
      filename ? `Source: ${filename}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const deal: PipelineDealMinimal = {
      id: newId(),
      ticker: tickerInput.trim().toUpperCase(),
      brokerName: brokerName.trim() || "—",
      assetClass: pipelineAsset,
      faceValueUsd: aggregates.totalFaceValue,
      askCentsPerDollar: askInput ? Number(askInput) || undefined : undefined,
      bidCentsPerDollar: Number(bid.disciplinedBidCentsPerDollar.toFixed(2)),
      stage: "reviewing",
      notes: summary,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY);
      const existing: PipelineDealMinimal[] = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(existing) ? existing : [];
      window.localStorage.setItem(
        PIPELINE_STORAGE_KEY,
        JSON.stringify([deal, ...arr])
      );
      setSavedDealId(deal.id);
      setShowSaveForm(false);
    } catch (err) {
      setError("Failed to save to pipeline: " + (err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      {/* DROP ZONE */}
      <section className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Step 1 · Upload a tape (CSV)
        </div>
        <h2 className="mt-2 text-2xl font-medium tracking-tight">
          Drop a tape. Get aggregates.
        </h2>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          The file is parsed in your browser and immediately discarded. PII columns
          (name, address, phone, SSN, account number) are skipped — Tradeline never
          stores or transmits row-level data.
        </p>

        <div className="mt-6 flex items-center gap-4 flex-wrap">
          <label className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition cursor-pointer">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={loadSample}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Load demo tape
          </button>
          {aggregates && (
            <button
              type="button"
              onClick={clear}
              className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
            >
              Clear
            </button>
          )}
          {filename && (
            <span className="font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
              {filename}
            </span>
          )}
        </div>

        {error && (
          <div className="mt-5 border border-[color:var(--color-danger)] bg-[color:var(--color-bg-1)] p-4 text-[14px] text-[color:var(--color-danger)]">
            {error}
          </div>
        )}
      </section>

      {/* RESULTS */}
      {aggregates && (
        <>
          {/* Headline aggregates */}
          <section>
            <SectionLabel>Step 2 · Tape aggregates</SectionLabel>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <Stat label="Accounts" value={aggregates.rowCount.toLocaleString()} />
              <Stat
                label="Face value"
                value={formatUSD(aggregates.totalFaceValue)}
                tone="ok"
              />
              <Stat
                label="Avg balance"
                value={formatUSD(aggregates.averageBalance)}
              />
              <Stat
                label="Median"
                value={formatUSD(aggregates.medianBalance)}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <Stat label="Min" value={formatUSD(aggregates.minBalance)} />
              <Stat label="Max" value={formatUSD(aggregates.maxBalance)} />
              <Stat
                label="States"
                value={aggregates.stateDistribution.length}
              />
              <Stat
                label="Vintage years"
                value={aggregates.vintageDistribution.length}
              />
            </div>

            {aggregates.warnings.length > 0 && (
              <div className="mt-4 border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-4">
                <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
                  Tape quality flags
                </div>
                <ul className="mt-2 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {aggregates.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div
              className="mt-5 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap"
              style={{
                background:
                  "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
                border: "1.5px solid transparent",
              }}
            >
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
                  Next action
                </div>
                <div className="mt-0.5 text-[14px] text-[color:var(--color-fg)]">
                  Your tape is scored. Now compose the bid email back to the broker.
                </div>
                <div className="mt-0.5 text-[11px] text-[color:var(--color-fg-dim)]">
                  Face value of <strong className="text-[color:var(--color-fg)]">{formatUSD(aggregates.totalFaceValue)}</strong> auto-passes to the calculator.
                </div>
              </div>
              <Link
                href={`/app/tools/bid-calculator?face=${aggregates.totalFaceValue}`}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded-full text-[#1a0c00] hover:opacity-90 transition shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                Compose bid email →
              </Link>
            </div>
          </section>

          {/* Distributions */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DistCard
              title="Geographic mix"
              empty={
                aggregates.hints.state
                  ? "No states parsed."
                  : "No state column detected."
              }
              items={aggregates.stateDistribution.map((s) => ({
                key: s.state,
                count: s.count,
                faceValue: s.faceValue,
              }))}
            />
            <DistCard
              title="Vintage distribution"
              empty={
                aggregates.hints.vintage
                  ? "No vintages parsed."
                  : "No vintage column detected."
              }
              items={aggregates.vintageDistribution.map((v) => ({
                key: v.period,
                count: v.count,
                faceValue: v.faceValue,
              }))}
            />
            <DistCard
              title="Asset classes"
              empty={
                aggregates.hints.assetClass
                  ? "No asset classes parsed."
                  : "Single-class tape (no breakdown column)."
              }
              items={aggregates.assetClassDistribution.map((a) => ({
                key: a.name,
                count: a.count,
                faceValue: a.faceValue,
              }))}
            />
          </section>

          {/* Bid heuristic */}
          {bid && (
            <section>
              <SectionLabel>Step 3 · Suggested bid (NPV at target IRR)</SectionLabel>
              <p className="mt-2 mb-4 text-[13px] text-[color:var(--color-fg-dim)] max-w-2xl">
                Asset-class defaults applied. Override the preset if you have
                better recovery data; the math is the same as{" "}
                <code className="font-mono text-[12px] text-[color:var(--color-fg)]">
                  /app/tools/bid-calculator
                </code>{" "}
                applied to this tape&rsquo;s face value.
              </p>

              <div className="mb-4 flex items-center gap-2 flex-wrap">
                {ASSET_DEFAULTS.map((d, i) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => {
                      setPresetIdx(i);
                      setOverrides(null);
                    }}
                    className={`font-mono text-[11px] tracking-[0.05em] uppercase px-3 py-2 border transition ${
                      preset.label === d.label && !overrides
                        ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                        : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line-strong)]">
                <Stat
                  label="Gross recovery (face × rate)"
                  value={formatUSD(bid.grossRecovery)}
                />
                <Stat
                  label="Net to you (after servicer)"
                  value={formatUSD(bid.netToBuyer)}
                  tone="ok"
                />
                <Stat
                  label="Max bid (NPV at IRR)"
                  value={formatUSD(bid.maxBid)}
                  sub={`${formatPct(bid.maxBidCentsPerDollar, 2)} of face`}
                  tone="strong"
                />
              </div>

              {/* Save to pipeline */}
              <div className="mt-6 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
                <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
                  Step 4 · Save to pipeline
                </div>
                {savedDealId ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-[14px] text-[color:var(--color-success)]">
                      ✓ Saved as a Reviewing deal. Now bid it back.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/app/tools/bid-calculator?face=${aggregates?.totalFaceValue ?? 0}&ticker=${encodeURIComponent(tickerInput.trim())}&bank=${encodeURIComponent(brokerName.trim())}&broker=${encodeURIComponent(brokerName.trim())}`}
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 rounded text-[#1a0c00] hover:opacity-90 transition"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        Compose bid email →
                      </Link>
                      <Link
                        href="/app/pipeline"
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:opacity-90 transition"
                      >
                        Open Pipeline →
                      </Link>
                    </div>
                  </div>
                ) : showSaveForm ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <SmallInput
                        label="Broker"
                        value={brokerName}
                        onChange={setBrokerName}
                        placeholder="e.g. Garnet Capital"
                      />
                      <SmallInput
                        label="Originator ticker"
                        value={tickerInput}
                        onChange={setTickerInput}
                        placeholder="e.g. WAL"
                      />
                      <SmallInput
                        label="Ask price (¢/$)"
                        value={askInput}
                        onChange={setAskInput}
                        placeholder="optional"
                        type="number"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={saveToPipeline}
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                      >
                        Save deal
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSaveForm(false)}
                        className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <p className="text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed flex-1 min-w-[200px]">
                      Save this analysis as a deal in your Pipeline. The disciplined
                      bid + summary become the deal record; you fill in the broker
                      and originator.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSaveForm(true)}
                      className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                    >
                      + Save to Pipeline
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
                <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
                  Recommendation
                </div>
                <p className="mt-2 text-[15px] text-[color:var(--color-fg)] leading-relaxed">
                  At <span className="font-mono">{preset.label}</span> defaults
                  ({formatPct(preset.recoveryPct, 1)} recovery over{" "}
                  {preset.workoutYears} years, {formatPct(preset.servicerFeePct, 0)}{" "}
                  servicer fee, {formatPct(preset.irrPct, 0)} IRR target):
                </p>
                <ul className="mt-3 space-y-1.5 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)]">
                  <li>
                    <strong className="text-[color:var(--color-fg)]">Maximum bid</strong>{" "}
                    <span className="font-mono text-[color:var(--color-accent)]">
                      {formatUSD(bid.maxBid)} · {formatPct(bid.maxBidCentsPerDollar, 2)}¢/$
                    </span>{" "}
                    — go above and the math doesn&rsquo;t pencil at your IRR.
                  </li>
                  <li>
                    <strong className="text-[color:var(--color-fg)]">Disciplined bid (15% margin)</strong>{" "}
                    <span className="font-mono text-[color:var(--color-warn)]">
                      {formatUSD(bid.disciplinedBid)} · {formatPct(bid.disciplinedBidCentsPerDollar, 2)}¢/$
                    </span>{" "}
                    — what most experienced buyers actually submit.
                  </li>
                </ul>
                <p className="mt-3 text-[12px] text-[color:var(--color-fg-faint)] leading-relaxed">
                  Heuristic, not a substitute for full underwriting. Adjust recovery
                  expectations if the tape&rsquo;s state mix is heavy in restrictive
                  jurisdictions (NY, MA, MD, CA), if vintage spans &gt; 4 years (lower
                  recovery), or if you&rsquo;re second-or-later buyer (significantly
                  lower recovery).
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "ok" | "strong" | "default";
}) {
  const color =
    tone === "strong"
      ? "text-[color:var(--color-accent)]"
      : tone === "ok"
      ? "text-[color:var(--color-fg)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
          {sub}
        </div>
      )}
    </div>
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
      <span className="block font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function mapToPipelineAssetClass(detected: string): string {
  const d = detected.toLowerCase();
  if (d.includes("auto") || d.includes("vehicle")) return "Auto";
  if (d.includes("medic") || d.includes("hospital")) return "Medical";
  if (d.includes("mortgage") || d.includes("real")) return "Junior mortgage";
  if (d.includes("commercial")) return "Commercial";
  if (d.includes("specialty")) return "Specialty";
  return "Credit card";
}

function DistCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: { key: string; count: number; faceValue: number }[];
  empty: string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="mt-3 text-[13px] text-[color:var(--color-fg-faint)]">{empty}</div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => {
            const pct = total > 0 ? (i.count / total) * 100 : 0;
            return (
              <li
                key={i.key}
                className="flex items-baseline gap-3 font-mono text-[12px]"
              >
                <span className="text-[color:var(--color-accent)] w-12">{i.key}</span>
                <span className="text-[color:var(--color-fg-dim)] flex-1">
                  {i.count.toLocaleString()} ({pct.toFixed(0)}%)
                </span>
                <span className="text-[color:var(--color-fg)] tick">
                  {formatUSD(i.faceValue)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
