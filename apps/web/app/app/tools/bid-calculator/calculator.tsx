"use client";

import { useState } from "react";

type AssetPreset = {
  label: string;
  faceValue: number;
  recoveryPct: number;
  workoutYears: number;
  servicerFeePct: number;
  irrPct: number;
};

const PRESETS: AssetPreset[] = [
  {
    label: "Fresh CC charge-off · mid-Atlantic",
    faceValue: 5_000_000,
    recoveryPct: 14,
    workoutYears: 5,
    servicerFeePct: 35,
    irrPct: 30,
  },
  {
    label: "Aged CC paper (2-3 years)",
    faceValue: 5_000_000,
    recoveryPct: 7,
    workoutYears: 4,
    servicerFeePct: 35,
    irrPct: 35,
  },
  {
    label: "Subprime auto (secured)",
    faceValue: 5_000_000,
    recoveryPct: 22,
    workoutYears: 3,
    servicerFeePct: 25,
    irrPct: 25,
  },
  {
    label: "Junior mortgage, seasoned",
    faceValue: 5_000_000,
    recoveryPct: 55,
    workoutYears: 4,
    servicerFeePct: 15,
    irrPct: 20,
  },
];

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(pct: number, digits = 1): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(digits)}%`;
}

export function BidCalculator() {
  const [face, setFace] = useState(PRESETS[0].faceValue);
  const [recoveryPct, setRecoveryPct] = useState(PRESETS[0].recoveryPct);
  const [workoutYears, setWorkoutYears] = useState(PRESETS[0].workoutYears);
  const [servicerFeePct, setServicerFeePct] = useState(PRESETS[0].servicerFeePct);
  const [irrPct, setIrrPct] = useState(PRESETS[0].irrPct);

  const grossRecovery = face * (recoveryPct / 100);
  const netRecovery = grossRecovery * (1 - servicerFeePct / 100);
  const discount = Math.pow(1 + irrPct / 100, workoutYears);
  const maxBid = netRecovery / discount;
  const maxBidCentsPerDollar = (maxBid / face) * 100;
  const safeBid = maxBid * 0.85;
  const safeBidCentsPerDollar = (safeBid / face) * 100;

  const applyPreset = (p: AssetPreset) => {
    setFace(p.faceValue);
    setRecoveryPct(p.recoveryPct);
    setWorkoutYears(p.workoutYears);
    setServicerFeePct(p.servicerFeePct);
    setIrrPct(p.irrPct);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-2">
          Quick presets
        </div>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="font-mono text-[11px] tracking-[0.05em] uppercase px-3 py-2 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition text-[color:var(--color-fg-dim)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <Slider
          label="Face value"
          value={face}
          min={100_000}
          max={500_000_000}
          step={100_000}
          format={formatUSD}
          onChange={setFace}
        />
        <Slider
          label="Expected recovery"
          value={recoveryPct}
          min={1}
          max={70}
          step={0.5}
          format={(v) => formatPct(v, 1) + " of face"}
          onChange={setRecoveryPct}
        />
        <Slider
          label="Work-out time"
          value={workoutYears}
          min={1}
          max={10}
          step={0.5}
          format={(v) => `${v} years`}
          onChange={setWorkoutYears}
        />
        <Slider
          label="Servicer fee"
          value={servicerFeePct}
          min={0}
          max={60}
          step={1}
          format={(v) => formatPct(v, 0) + " of collected"}
          onChange={setServicerFeePct}
        />
        <Slider
          label="Target IRR"
          value={irrPct}
          min={5}
          max={60}
          step={1}
          format={(v) => formatPct(v, 0) + " annual"}
          onChange={setIrrPct}
        />
        <div className="bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Reset
          </div>
          <button
            type="button"
            onClick={() => applyPreset(PRESETS[0])}
            className="mt-3 font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Default preset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line-strong)]">
        <Result label="Gross recovery (face × rate)" value={formatUSD(grossRecovery)} />
        <Result
          label="Net to you (after servicer)"
          value={formatUSD(netRecovery)}
          tone="ok"
        />
        <Result
          label="Max bid (NPV at IRR)"
          value={formatUSD(maxBid)}
          sub={`${formatPct(maxBidCentsPerDollar, 2)} of face`}
          tone="strong"
        />
      </div>

      <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What this means
        </div>
        <p className="mt-3 text-[15px] text-[color:var(--color-fg)] leading-relaxed">
          On <span className="font-mono">{formatUSD(face)}</span> face value paper recovering{" "}
          <span className="font-mono">{formatPct(recoveryPct, 1)}</span> over{" "}
          <span className="font-mono">{workoutYears} years</span>, at a target IRR of{" "}
          <span className="font-mono">{formatPct(irrPct, 0)}</span>:
        </p>
        <ul className="mt-3 space-y-1.5 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>
            <strong className="text-[color:var(--color-fg)]">Maximum bid</strong>{" "}
            <span className="font-mono">{formatUSD(maxBid)}</span> ·{" "}
            <span className="text-[color:var(--color-accent)]">{formatPct(maxBidCentsPerDollar, 2)}¢/dollar</span> — go above and the math doesn&rsquo;t pencil at your IRR target.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Disciplined bid (15% margin)</strong>{" "}
            <span className="font-mono">{formatUSD(safeBid)}</span> ·{" "}
            <span className="text-[color:var(--color-warn)]">{formatPct(safeBidCentsPerDollar, 2)}¢/dollar</span> — what most experienced buyers actually submit, leaving room for surprises.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          {label}
        </div>
        <div className="font-mono text-[15px] text-[color:var(--color-accent)] tick">
          {format(value)}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[color:var(--color-accent)]"
      />
    </div>
  );
}

function Result({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
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
        <div className="mt-1 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
          {sub}
        </div>
      )}
    </div>
  );
}
