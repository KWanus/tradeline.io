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
  | { kind: "unconfigured"; missing: number }
  | { kind: "urgent"; criticalCount: number; warnCount: number }
  | { kind: "healthy"; activeLicenses: number };

function computeSpineState(): SpineState {
  if (typeof window === "undefined") {
    return { kind: "healthy", activeLicenses: 0 };
  }

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
    return { kind: "unconfigured", missing: missingPillars };
  }

  // Urgency check
  let critical = 0;
  let warn = 0;

  // Licenses
  const expired = expiredLicenses(licenses);
  critical += expired.length;
  const expiring = expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS);
  for (const l of expiring) {
    const ts = new Date(l.expirationDate).getTime();
    const days = Math.floor((ts - Date.now()) / 86_400_000);
    if (days <= 7) critical++;
    else warn++;
  }

  // Returns
  const returnsRecords = readReturns();
  if (returnsRecords.length > 0) {
    const holdings = readHoldingsForReturns();
    const holdingsById = new Map<string, HoldingForReturns>();
    for (const h of holdings) holdingsById.set(h.id, h);
    const report = buildReturnsReport(returnsRecords, holdingsById);
    for (const r of report.urgentReturns) {
      if (r.urgencyTier === "expired") critical++;
      else warn++;
    }
  }

  // Capital over-commit
  if (capital.configured && capital.available < 0) {
    warn++;
  }

  if (critical + warn > 0) {
    return { kind: "urgent", criticalCount: critical, warnCount: warn };
  }
  return { kind: "healthy", activeLicenses };
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

  // Pill styling mirrors the Autopilot pill (Tailwind class strings)
  if (state.kind === "unconfigured") {
    return (
      <Link
        href="/app/today"
        title={`Spine setup incomplete — ${state.missing} pillar${state.missing === 1 ? "" : "s"} missing. Configure at /app/today.`}
        className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] border transition bg-[color:var(--color-warn-soft)] border-[color:var(--color-warn)] text-[color:var(--color-warn)] hover:opacity-90"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-warn)]" />
        <span>OS · setup</span>
      </Link>
    );
  }

  if (state.kind === "urgent") {
    const total = state.criticalCount + state.warnCount;
    const tone =
      state.criticalCount > 0
        ? "bg-[color:var(--color-danger-soft,var(--color-warn-soft))] border-[color:var(--color-danger)] text-[color:var(--color-danger)]"
        : "bg-[color:var(--color-warn-soft)] border-[color:var(--color-warn)] text-[color:var(--color-warn)]";
    const dot =
      state.criticalCount > 0
        ? "bg-[color:var(--color-danger)] glow"
        : "bg-[color:var(--color-warn)] glow";
    return (
      <Link
        href="/app/today"
        title={`Operator OS — ${state.criticalCount} critical, ${state.warnCount} warn. Open /app/today.`}
        className={`hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] border transition hover:opacity-90 ${tone}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span>
          OS · {total} urgent{state.criticalCount > 0 ? ` (${state.criticalCount}!)` : ""}
        </span>
      </Link>
    );
  }

  // Healthy
  return (
    <Link
      href="/app/today"
      title={`Operator OS healthy — ${state.activeLicenses} licensed state${state.activeLicenses === 1 ? "" : "s"}, capital + concentration configured.`}
      className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] border transition bg-[color:var(--color-success-soft)] border-[color:var(--color-success-dim)] text-[color:var(--color-success)] hover:opacity-90"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-success)] glow" />
      <span>OS · ok · {state.activeLicenses}st</span>
    </Link>
  );
}
