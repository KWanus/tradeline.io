"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCapitalState } from "@/lib/capital";
import {
  expiredLicenses,
  expiringWithinDays,
  licenseStatus,
  readLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
} from "@/lib/compliance-licenses";
import {
  buildReturnsReport,
  readReturns,
  type HoldingForReturns,
} from "@/lib/returns-tracker";
import { readConcentrationPolicy } from "@/lib/tape-concentration-policy";
import { SpineStateTooltip, type PillarUrgency } from "./spine-state-tooltip";

// Compact topbar pill mirroring the Autopilot pill — always-visible OS
// health summary. Three states:
//   - unconfigured: spine setup incomplete (one or more of capital +
//     compliance licenses + concentration policy missing)
//   - urgent: one or more critical items (lapsed license, expired return
//     window, capital over-commit)
//   - healthy: configured + zero urgents

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type RawHolding = {
  id?: string;
  ticker?: string;
  seller?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  purchaseDate?: string;
};

function readHoldingsForReturns(): HoldingForReturns[] {
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
      faceValueUsd: Number(h.faceValueUsd) || 0,
      purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
      purchaseDate: String(h.purchaseDate ?? ""),
    }));
  } catch {
    return [];
  }
}

type SpineState =
  | { kind: "unconfigured"; missing: number; urgencyByPillar: PillarUrgency }
  | { kind: "urgent"; criticalCount: number; warnCount: number; urgencyByPillar: PillarUrgency }
  | { kind: "healthy"; activeLicenses: number; urgencyByPillar: PillarUrgency };

function computeSpineState(): SpineState {
  if (typeof window === "undefined") {
    return { kind: "healthy", activeLicenses: 0, urgencyByPillar: {} };
  }

  const urgencyByPillar: PillarUrgency = {};

  // Configured-ness check
  const licenses = readLicenses();
  const activeLicenses = licenses.filter((l) => licenseStatus(l) !== "expired").length;
  const capital = readCapitalState();
  const concentration = readConcentrationPolicy();
  const missingPillars =
    (activeLicenses > 0 ? 0 : 1) +
    (capital.configured ? 0 : 1) +
    (concentration ? 0 : 1);
  if (missingPillars > 0) {
    return { kind: "unconfigured", missing: missingPillars, urgencyByPillar };
  }

  // Urgency check
  let critical = 0;
  let warn = 0;

  // Licenses
  const expired = expiredLicenses(licenses);
  critical += expired.length;
  let complianceUrgent = expired.length;
  const expiring = expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS);
  for (const l of expiring) {
    const ts = new Date(l.expirationDate).getTime();
    const days = Math.floor((ts - Date.now()) / 86_400_000);
    if (days <= 7) critical++;
    else warn++;
    complianceUrgent++;
  }
  if (complianceUrgent > 0) urgencyByPillar.compliance = complianceUrgent;

  // Returns
  const returnsRecords = readReturns();
  let returnsUrgent = 0;
  if (returnsRecords.length > 0) {
    const holdings = readHoldingsForReturns();
    const holdingsById = new Map<string, HoldingForReturns>();
    for (const h of holdings) holdingsById.set(h.id, h);
    const report = buildReturnsReport(returnsRecords, holdingsById);
    for (const r of report.urgentReturns) {
      if (r.urgencyTier === "expired") critical++;
      else warn++;
      returnsUrgent++;
    }
  }
  if (returnsUrgent > 0) urgencyByPillar.returns = returnsUrgent;

  // Capital over-commit
  if (capital.configured && capital.available < 0) {
    warn++;
    urgencyByPillar.capital = 1;
  }

  if (critical + warn > 0) {
    return { kind: "urgent", criticalCount: critical, warnCount: warn, urgencyByPillar };
  }
  return { kind: "healthy", activeLicenses, urgencyByPillar };
}

export function SpineStateBadge() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setHydrated(true);
    function onStorage() {
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener("storage", onStorage);
    const t = setInterval(() => setRefreshKey((k) => k + 1), 5 * 60 * 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);

  const state = useMemo(() => {
    if (!hydrated) return null;
    return computeSpineState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  if (!state) return null;

  let pillTitle: string;
  let pillClasses: string;
  let pillDotClasses: string;
  let pillLabel: string;
  if (state.kind === "unconfigured") {
    pillTitle = `Spine setup incomplete — ${state.missing} pillar${state.missing === 1 ? "" : "s"} missing. Configure at /app/today.`;
    pillClasses =
      "bg-[color:var(--color-warn-soft)] border-[color:var(--color-warn)] text-[color:var(--color-warn)]";
    pillDotClasses = "bg-[color:var(--color-warn)]";
    pillLabel = "OS · setup";
  } else if (state.kind === "urgent") {
    const total = state.criticalCount + state.warnCount;
    pillTitle = `Operator OS — ${state.criticalCount} critical, ${state.warnCount} warn. Hover for breakdown.`;
    pillClasses =
      state.criticalCount > 0
        ? "bg-[color:var(--color-danger-soft,var(--color-warn-soft))] border-[color:var(--color-danger)] text-[color:var(--color-danger)]"
        : "bg-[color:var(--color-warn-soft)] border-[color:var(--color-warn)] text-[color:var(--color-warn)]";
    pillDotClasses =
      state.criticalCount > 0
        ? "bg-[color:var(--color-danger)] glow"
        : "bg-[color:var(--color-warn)] glow";
    pillLabel = `OS · ${total} urgent${state.criticalCount > 0 ? ` (${state.criticalCount}!)` : ""}`;
  } else {
    pillTitle = `Operator OS healthy — ${state.activeLicenses} licensed state${state.activeLicenses === 1 ? "" : "s"}, capital + concentration configured. Hover for activity.`;
    pillClasses =
      "bg-[color:var(--color-success-soft)] border-[color:var(--color-success-dim)] text-[color:var(--color-success)]";
    pillDotClasses = "bg-[color:var(--color-success)] glow";
    pillLabel = `OS · ok · ${state.activeLicenses}st`;
  }

  // Wrap pill in a hover-popover container. Pill stays a Link to
  // /app/today (preserves click semantics); popover only renders on
  // hover/focus.
  return (
    <span className="hidden md:inline-block relative group">
      <Link
        href="/app/today"
        title={pillTitle}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] border transition hover:opacity-90 ${pillClasses}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${pillDotClasses}`} />
        <span>{pillLabel}</span>
      </Link>
      <span
        className="pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity absolute top-full right-0 mt-2"
        aria-hidden
      >
        <SpineStateTooltip urgencyByPillar={state.urgencyByPillar} />
      </span>
    </span>
  );
}
