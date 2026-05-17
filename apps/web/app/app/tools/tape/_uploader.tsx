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

// A handful of curated sample tapes that exercise different paths through the
// analyzer (mix of asset classes, vintages, state concentrations). Each one
// shows the bid math under a different deal profile so first-time visitors see
// what the copilot is actually doing.
//
// All accounts here are SYNTHETIC. Names/phones/SSNs are zero-padded
// placeholders so it's visibly fake; the parser strips PII columns anyway.
type SampleTape = {
  id: string;
  label: string;
  description: string;
  csv: string;
};

const SAMPLE_TAPES: SampleTape[] = [
  {
    id: "card-fresh",
    label: "Fresh credit card · $2.1M face",
    description:
      "30-account credit-card tape, 6-12 month vintages, mid-Atlantic + south concentration. Typical first-tape size from a regional bank broker.",
    csv: [
      "account_balance,state,charge_off_date,asset_type,first_name,last_name,phone,ssn",
      "85234.12,GA,2025-09-15,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "41822.55,VA,2025-11-02,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "112450.00,NY,2025-07-20,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "27011.18,CA,2025-08-08,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "93840.40,TX,2025-12-11,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "67129.99,FL,2025-10-28,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "43500.00,GA,2025-09-29,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "21994.45,NC,2025-07-04,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "89005.50,MD,2025-11-19,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "14500.00,VA,2025-08-22,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "58200.00,SC,2025-06-30,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "39100.00,TN,2025-10-05,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "72400.00,AL,2025-08-18,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "18800.00,MS,2025-09-12,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "104500.00,LA,2025-07-11,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "55900.00,KY,2025-11-25,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "33000.00,GA,2025-12-04,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "47600.00,VA,2025-10-15,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "29800.00,WV,2025-09-22,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "61700.00,DC,2025-08-30,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "92500.00,MD,2025-07-28,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "17400.00,DE,2025-10-09,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "53200.00,PA,2025-06-19,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "38900.00,NJ,2025-08-04,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "76100.00,CT,2025-11-14,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "24800.00,RI,2025-09-26,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "44600.00,MA,2025-07-17,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "31200.00,NH,2025-10-31,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "82400.00,ME,2025-08-13,credit card,Sample,Sample,000-000-0000,000-00-0000",
      "15600.00,VT,2025-12-08,credit card,Sample,Sample,000-000-0000,000-00-0000",
    ].join("\n"),
  },
  {
    id: "card-aged",
    label: "Aged credit card · $1.4M face · 2-3yr vintage",
    description:
      "Junky tape — older vintages, mixed states, more skips expected. Price discipline matters here: the math says walk unless you can buy at 1.5¢/$ or below.",
    csv: [
      "account_balance,state,charge_off_date,asset_type,first_name,last_name,phone,ssn",
      "92340.00,TX,2023-04-12,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "55180.00,FL,2023-06-22,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "71200.00,CA,2022-11-08,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "38400.00,NY,2023-02-15,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "104500.00,GA,2022-09-30,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "67800.00,IL,2023-07-19,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "23400.00,OH,2023-05-04,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "88900.00,PA,2022-12-11,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "41200.00,NC,2023-03-26,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "76500.00,MI,2022-10-17,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "29800.00,AZ,2023-08-09,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "112400.00,NV,2022-07-23,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "47600.00,WA,2023-01-14,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "63200.00,CO,2022-08-28,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "35900.00,UT,2023-06-05,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "81700.00,OR,2022-11-21,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "26400.00,KS,2023-04-29,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "98300.00,MO,2022-09-13,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "54200.00,IN,2023-07-30,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
      "39800.00,WI,2022-12-04,credit card aged,Sample,Sample,000-000-0000,000-00-0000",
    ].join("\n"),
  },
  {
    id: "mortgage-junior",
    label: "Junior mortgage · $4.8M face · seasoned",
    description:
      "Smaller account count, much larger per-account balances. Different math entirely — recovery is much higher because there's collateral, workout takes longer.",
    csv: [
      "balance,state,vintage,asset_type,first_name,last_name,phone",
      "245000,GA,2021-03-15,junior mortgage,Sample,Sample,000-000-0000",
      "318500,FL,2020-11-22,junior mortgage,Sample,Sample,000-000-0000",
      "412700,CA,2021-06-08,junior mortgage,Sample,Sample,000-000-0000",
      "189400,NY,2020-09-30,junior mortgage,Sample,Sample,000-000-0000",
      "354800,TX,2021-04-19,junior mortgage,Sample,Sample,000-000-0000",
      "276100,NC,2020-12-11,junior mortgage,Sample,Sample,000-000-0000",
      "498300,MD,2021-07-26,junior mortgage,Sample,Sample,000-000-0000",
      "223600,VA,2020-10-17,junior mortgage,Sample,Sample,000-000-0000",
      "395200,PA,2021-05-04,junior mortgage,Sample,Sample,000-000-0000",
      "267900,NJ,2020-08-23,junior mortgage,Sample,Sample,000-000-0000",
      "341500,CT,2021-02-14,junior mortgage,Sample,Sample,000-000-0000",
      "298400,MA,2020-11-28,junior mortgage,Sample,Sample,000-000-0000",
      "452800,WA,2021-06-05,junior mortgage,Sample,Sample,000-000-0000",
      "186200,OR,2020-09-21,junior mortgage,Sample,Sample,000-000-0000",
      "513000,CO,2021-04-29,junior mortgage,Sample,Sample,000-000-0000",
    ].join("\n"),
  },
  {
    id: "auto-recent",
    label: "Auto (subprime) · $890k face · recent",
    description:
      "Subprime auto, secured by the vehicle. Different recovery curve from unsecured paper. Servicer matters a lot here — vehicle title workflows are specialist work.",
    csv: [
      "face_value,billing_state,co_date,product,first_name,last_name",
      "18400,GA,2025-01-22,auto subprime,Sample,Sample",
      "22100,TX,2024-11-14,auto subprime,Sample,Sample",
      "15600,FL,2025-03-08,auto subprime,Sample,Sample",
      "27300,NC,2024-10-29,auto subprime,Sample,Sample",
      "19800,AL,2025-02-17,auto subprime,Sample,Sample",
      "31400,MS,2024-12-04,auto subprime,Sample,Sample",
      "23900,LA,2025-01-30,auto subprime,Sample,Sample",
      "16200,SC,2024-09-18,auto subprime,Sample,Sample",
      "28600,TN,2025-04-11,auto subprime,Sample,Sample",
      "20100,KY,2024-11-26,auto subprime,Sample,Sample",
      "33700,WV,2025-02-22,auto subprime,Sample,Sample",
      "24500,VA,2024-12-19,auto subprime,Sample,Sample",
      "17800,MD,2025-03-15,auto subprime,Sample,Sample",
      "30200,PA,2024-10-08,auto subprime,Sample,Sample",
      "21400,OH,2025-01-04,auto subprime,Sample,Sample",
      "26800,IN,2024-11-21,auto subprime,Sample,Sample",
      "19500,IL,2025-03-26,auto subprime,Sample,Sample",
      "32100,MO,2024-12-14,auto subprime,Sample,Sample",
      "23600,AR,2025-02-08,auto subprime,Sample,Sample",
      "28900,OK,2024-10-31,auto subprime,Sample,Sample",
      "20700,KS,2025-01-19,auto subprime,Sample,Sample",
      "25400,NE,2024-11-07,auto subprime,Sample,Sample",
      "31800,IA,2025-03-04,auto subprime,Sample,Sample",
      "22300,WI,2024-12-22,auto subprime,Sample,Sample",
      "29100,MI,2025-02-13,auto subprime,Sample,Sample",
      "18900,MN,2024-10-26,auto subprime,Sample,Sample",
      "27600,ND,2025-04-02,auto subprime,Sample,Sample",
      "23100,SD,2024-11-13,auto subprime,Sample,Sample",
      "30500,MT,2025-01-27,auto subprime,Sample,Sample",
      "21700,WY,2024-12-09,auto subprime,Sample,Sample",
      "26200,ID,2025-03-21,auto subprime,Sample,Sample",
      "19300,NV,2024-10-15,auto subprime,Sample,Sample",
      "32700,UT,2025-02-28,auto subprime,Sample,Sample",
      "24800,AZ,2024-11-30,auto subprime,Sample,Sample",
      "28400,NM,2025-01-12,auto subprime,Sample,Sample",
    ].join("\n"),
  },
];

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
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

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
    setActiveSampleId(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      processText(text, file.name);
    };
    reader.readAsText(file);
  }

  function loadSample(id: string) {
    const sample = SAMPLE_TAPES.find((s) => s.id === id);
    if (!sample) return;
    processText(sample.csv, `${sample.label} (sample)`);
    setActiveSampleId(id);
    // Scroll the results section into view so the user immediately sees
    // what they triggered.
    setTimeout(() => {
      const el = document.getElementById("tape-results");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
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
    setActiveSampleId(null);
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

        {/* Sample picker — primary CTA for first-time visitors who don't have a real tape yet. */}
        <div
          className="mt-6 rounded-xl p-5"
          style={{
            background:
              "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            border: "1.5px solid transparent",
          }}
        >
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            No tape yet? Try a sample
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Each sample is a curated synthetic CSV that exercises a different
            asset profile so you can see the bid math under different deal
            shapes. Loading a sample auto-detects the asset class, suggests
            the right recovery defaults, and scrolls to the analysis.
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {SAMPLE_TAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s.id)}
                title={s.description}
                className={`font-mono text-[11px] tracking-[0.05em] px-3 py-2 rounded transition ${
                  activeSampleId === s.id
                    ? "border border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                }`}
              >
                {activeSampleId === s.id ? "★ " : ""}
                {s.label}
              </button>
            ))}
          </div>
          {activeSampleId && (
            <p className="mt-3 text-[11px] font-mono text-[color:var(--color-fg-faint)] leading-relaxed">
              {SAMPLE_TAPES.find((s) => s.id === activeSampleId)?.description}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-5 border border-[color:var(--color-danger)] bg-[color:var(--color-bg-1)] p-4 text-[14px] text-[color:var(--color-danger)]">
            {error}
          </div>
        )}
      </section>

      {/* Demo banner — visible above results when a sample is loaded */}
      {aggregates && activeSampleId && (
        <div className="rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] text-[color:var(--color-warn)] leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase mr-2">
              Demo data
            </span>
            All accounts below are synthetic. Save-to-pipeline still works so
            you can see the round-trip into{" "}
            <Link href="/app/pipeline" className="underline hover:opacity-80">
              /app/pipeline
            </Link>
            .
          </div>
          <button
            type="button"
            onClick={clear}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-warn)] text-[color:var(--color-warn)] hover:bg-[color:var(--color-warn)] hover:text-[color:var(--color-bg)] transition"
          >
            Clear sample
          </button>
        </div>
      )}

      {/* RESULTS */}
      {aggregates && (
        <>
          {/* Headline aggregates */}
          <section id="tape-results">
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
