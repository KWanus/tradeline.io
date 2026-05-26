"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  activeLicensedStates,
  readLicenses,
} from "@/lib/compliance-licenses";
import {
  acknowledgeRule,
  CATEGORY_LABELS,
  relevantRules,
  type RelevantRule,
  type RuleSeverity,
} from "@/lib/state-rule-changelog";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type RawHolding = { assetClass?: string };

function readBookAssetClasses(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const set = new Set<string>();
    for (const h of parsed as RawHolding[]) {
      if (h.assetClass) set.add(h.assetClass);
    }
    return Array.from(set);
  } catch {
    return [];
  }
}

const SEVERITY_COLOR: Record<RuleSeverity, string> = {
  critical: "var(--color-danger)",
  high: "var(--color-warn)",
  moderate: "var(--color-fg-dim)",
};

export function RuleChangeBanner() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setHydrated(true);
    function onStorage() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const rules = useMemo<RelevantRule[]>(() => {
    if (!hydrated) return [];
    const states = activeLicensedStates(readLicenses());
    const assetClasses = readBookAssetClasses();
    return relevantRules({
      states,
      assetClasses,
      includeAcknowledged: false,
    });
  }, [hydrated, refreshKey]);

  if (!hydrated || rules.length === 0) return null;

  const critical = rules.filter((r) => r.severity === "critical");
  const headline = rules[0]; // already sorted critical-first, most-recent-first
  const headlineColor = SEVERITY_COLOR[headline.severity];

  function acknowledge(id: string) {
    acknowledgeRule(id);
    setRefreshKey((k) => k + 1);
  }

  return (
    <section
      className="mb-6 rounded-xl border bg-[color:var(--color-bg-1)] p-4"
      style={{ borderColor: headlineColor }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.18em] uppercase font-semibold"
            style={{ background: headlineColor, color: "var(--color-bg)" }}
          >
            {rules.length} state-rule change{rules.length === 1 ? "" : "s"}
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Affecting your licensed states
          </span>
          {critical.length > 0 && (
            <span className="font-mono text-[10px] text-[color:var(--color-danger)]">
              {critical.length} critical
            </span>
          )}
        </div>
        <Link
          href="/app/compliance#rule-changelog"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Full feed →
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {rules.slice(0, 3).map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 py-2 border-b border-[color:var(--color-line)] last:border-0"
          >
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-[0.08em] font-semibold uppercase shrink-0 self-center"
              style={{
                background: SEVERITY_COLOR[r.severity],
                color: "var(--color-bg)",
              }}
            >
              {r.state} · {r.severity}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-[color:var(--color-fg)] font-medium">
                {r.title}
              </div>
              <div className="mt-0.5 text-[11.5px] text-[color:var(--color-fg-dim)] leading-snug">
                {r.impact}
              </div>
              <div className="mt-1 flex items-center gap-3 flex-wrap font-mono text-[10px] text-[color:var(--color-fg-faint)]">
                <span>{CATEGORY_LABELS[r.category]}</span>
                <span>
                  effective {r.dateEffective}
                  {r.daysAgoEffective >= 0
                    ? ` (${r.daysAgoEffective}d ago)`
                    : ` (in ${Math.abs(r.daysAgoEffective)}d)`}
                </span>
                <a
                  href={r.source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  source →
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={() => acknowledge(r.id)}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] hover:text-[color:var(--color-fg)] transition shrink-0 self-center"
              title="Mark as acknowledged — won't show in this banner again"
            >
              ✓
            </button>
          </li>
        ))}
        {rules.length > 3 && (
          <li className="font-mono text-[10px] text-[color:var(--color-fg-faint)] italic pt-1">
            +{rules.length - 3} more at /app/compliance#rule-changelog
          </li>
        )}
      </ul>
    </section>
  );
}
