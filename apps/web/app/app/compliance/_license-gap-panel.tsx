"use client";

import { useMemo } from "react";
import {
  activeLicensedStates,
  type License,
} from "@/lib/compliance-licenses";
import { NO_LICENSE_REQUIRED_STATES } from "@/lib/tape-license-map";
import { SOL_CHART } from "@/lib/sol-chart";

// "Strict-jurisdiction" gap states — operators expanding into these without
// the proper license eat AG / CFPB risk quickly. Curated list from public
// licensing guides (Fitzgerald Advisors, Cornerstone Licensing, NCLC).
const STRICT_GAP_STATES: ReadonlyArray<string> = ["CA", "NY", "MA", "MD", "IL", "CO", "WA"];

// All US states + DC (51) — derived from the SOL chart which we know is
// complete.
const ALL_STATE_CODES = SOL_CHART.map((s) => s.state);

export function LicenseGapPanel({ licenses }: { licenses: License[] }) {
  const summary = useMemo(() => {
    const activeStates = new Set(activeLicensedStates(licenses));
    const licensedCount = activeStates.size;
    const noLicenseRequiredNotDeclared = NO_LICENSE_REQUIRED_STATES.filter(
      (s) => !activeStates.has(s)
    );
    const strictGaps = STRICT_GAP_STATES.filter((s) => !activeStates.has(s));
    const otherGaps = ALL_STATE_CODES.filter(
      (s) =>
        !activeStates.has(s) &&
        !NO_LICENSE_REQUIRED_STATES.includes(s) &&
        !STRICT_GAP_STATES.includes(s)
    );
    return {
      licensedCount,
      licensedStates: Array.from(activeStates).sort(),
      noLicenseRequiredNotDeclared,
      strictGaps,
      otherGaps,
      totalStates: ALL_STATE_CODES.length,
    };
  }, [licenses]);

  return (
    <section className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            License gap analysis
          </div>
          <p className="mt-1 text-[12.5px] text-[color:var(--color-fg-dim)] leading-snug">
            What's covered, what's a no-license-required state worth recording, and what's an
            unlicensed gap in a strict jurisdiction.
          </p>
        </div>
        <div className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
          {summary.licensedCount} of {summary.totalStates} states
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <GapColumn
          label="Strict-state gaps"
          tone="danger"
          states={summary.strictGaps}
          empty="✓ Covered in all strict-jurisdiction states."
          hint="Restrictive consumer-protection regimes — AG / CFPB enforcement risk is highest here. License or stay out."
        />
        <GapColumn
          label="No-license-required (not recorded)"
          tone="warn"
          states={summary.noLicenseRequiredNotDeclared}
          empty="✓ All no-license-required states recorded."
          hint="Per public licensing guides, these states don't require a debt-buyer license. Record a placeholder so the shield doesn't block sends."
        />
        <GapColumn
          label="Other unlicensed states"
          tone="neutral"
          states={summary.otherGaps}
          empty="✓ Covered everywhere."
          hint="States where licensing is generally required but not in the strict-enforcement tier. Expand here as deal flow demands."
        />
      </div>

      {summary.licensedStates.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer list-none font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition">
            ▸ Covered states ({summary.licensedStates.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {summary.licensedStates.map((s) => (
              <span
                key={s}
                className="font-mono text-[10px] px-2 py-0.5 rounded bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] border border-[color:var(--color-success)]"
              >
                {s}
              </span>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function GapColumn({
  label,
  tone,
  states,
  empty,
  hint,
}: {
  label: string;
  tone: "danger" | "warn" | "neutral";
  states: ReadonlyArray<string>;
  empty: string;
  hint: string;
}) {
  const accent =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "warn"
      ? "var(--color-warn)"
      : "var(--color-fg-dim)";
  return (
    <div className="border bg-[color:var(--color-bg)] p-4 rounded" style={{ borderColor: accent }}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: accent }}>
          {label}
        </div>
        <div className="font-mono text-[14px] font-semibold" style={{ color: accent }}>
          {states.length}
        </div>
      </div>
      {states.length === 0 ? (
        <p className="mt-2 text-[12px] text-[color:var(--color-success)]">{empty}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1">
          {states.map((s) => (
            <span
              key={s}
              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--color-bg-1)] text-[color:var(--color-fg-dim)] border border-[color:var(--color-line)]"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-[color:var(--color-fg-faint)] italic leading-snug">
        {hint}
      </p>
    </div>
  );
}
