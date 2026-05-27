"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCapitalState, type CapitalState } from "@/lib/capital";
import {
  daysUntil,
  expiredLicenses,
  expiringWithinDays,
  readLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
  type License,
} from "@/lib/compliance-licenses";
import {
  buildReturnsReport,
  readReturns,
  type EnrichedReturn,
  type HoldingForReturns,
} from "@/lib/returns-tracker";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type RawHolding = {
  id?: string;
  ticker?: string;
  seller?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  purchaseDate?: string;
};

// ---------------------------------------------------------------------------
// Unified urgent-queue item shape
// ---------------------------------------------------------------------------

type UrgencySeverity = "critical" | "high" | "medium";

type UrgentItem = {
  id: string;
  severity: UrgencySeverity;
  pillar: "compliance" | "returns" | "capital" | "pipeline";
  icon: string; // single char
  label: string; // short noun phrase
  detail: string; // 1-2 sentences
  faceDollars?: number; // for sort tie-break
  daysContext?: number; // negative = past
  action: { href: string; label: string };
};

// Read pipeline deals from localStorage without coupling to the full
// pipeline lib (single shape used here).
type StalledDeal = {
  id?: string;
  ticker?: string;
  brokerName?: string;
  assetClass?: string;
  faceValueUsd?: number;
  stage?: string;
  updatedAt?: string;
};
const PIPELINE_KEY = "tradeline.pipeline.deals.v1";
const STALLED_DAYS = 14;
const NON_TERMINAL_STAGES = new Set([
  "sourced",
  "reviewing",
  "underwriting",
  "bidding",
]);

function readStalledDeals(): StalledDeal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIPELINE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StalledDeal[];
  } catch {
    return [];
  }
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function readHoldings(): HoldingForReturns[] {
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

// ---------------------------------------------------------------------------
// Build the unified queue from current localStorage state
// ---------------------------------------------------------------------------

function buildItems(): UrgentItem[] {
  if (typeof window === "undefined") return [];
  const items: UrgentItem[] = [];

  // Compliance: expired + urgent-expiring licenses
  const licenses: License[] = readLicenses();
  for (const l of expiredLicenses(licenses)) {
    const ago = Math.abs(daysUntil(l.expirationDate));
    items.push({
      id: `compliance_expired_${l.id}`,
      severity: "critical",
      pillar: "compliance",
      icon: "§",
      label: `${l.state} ${l.licenseType} license LAPSED`,
      detail: `Expired ${ago}d ago (${l.expirationDate}). The compliance shield will block outreach + bids to ${l.state} until renewed.`,
      daysContext: -ago,
      action: { href: "/app/compliance", label: "Renew →" },
    });
  }
  for (const l of expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS)) {
    const days = daysUntil(l.expirationDate);
    items.push({
      id: `compliance_expiring_${l.id}`,
      severity: days <= 14 ? "high" : "medium",
      pillar: "compliance",
      icon: "§",
      label: `${l.state} ${l.licenseType} license expires in ${days}d`,
      detail: `State renewal processing typically takes 30-60 days. Start paperwork now or lose the state when it lapses.`,
      daysContext: days,
      action: { href: "/app/compliance", label: "Open renewal →" },
    });
  }

  // Returns: urgent (expired or critical-window)
  const holdings = readHoldings();
  const holdingsById = new Map<string, HoldingForReturns>();
  for (const h of holdings) holdingsById.set(h.id, h);
  const returnsRecords = readReturns();
  if (returnsRecords.length > 0) {
    const report = buildReturnsReport(returnsRecords, holdingsById);
    for (const r of report.urgentReturns) {
      const refund = r.refundExpectedUsd ?? r.refundExpectedAuto;
      const isExpired = r.urgencyTier === "expired";
      items.push({
        id: `returns_${r.id}`,
        severity: isExpired ? "critical" : "high",
        pillar: "returns",
        icon: "⏎",
        label: isExpired
          ? `Return window EXPIRED — ${fmtUsd(refund)} at risk`
          : `Return due in ${r.daysRemaining ?? 0}d — ${fmtUsd(refund)} refund`,
        detail: isExpired
          ? `${Math.abs(r.daysRemaining ?? 0)}d past window. Send notice immediately and dispute in good faith — sellers sometimes honor late returns.`
          : `Send return notice this week. Most sellers reject late returns even by 1 day.`,
        faceDollars: refund,
        daysContext: r.daysRemaining ?? 0,
        action: { href: "/app/portfolio", label: "Send notice →" },
      });
    }
  }

  // Capital: over-committed
  let capital: CapitalState | null = null;
  try {
    capital = readCapitalState();
  } catch {
    capital = null;
  }
  if (capital && capital.configured && capital.available < 0) {
    items.push({
      id: "capital_overcommit",
      severity: "high",
      pillar: "capital",
      icon: "$",
      label: `Capital over-committed by ${fmtUsd(Math.abs(capital.available))}`,
      detail: `Owned tapes (${fmtUsd(capital.deployed)}) + live bids (${fmtUsd(capital.committed)}) exceed total capital. Drop a live bid, raise capital, or walk a deal.`,
      faceDollars: Math.abs(capital.available),
      action: { href: "/app/capital", label: "Open capital →" },
    });
  }

  // Pipeline: deals stalled in non-terminal stages >14 days. Surfaces
  // deals that quietly age out — broker waiting, operator forgot.
  const deals = readStalledDeals();
  for (const d of deals) {
    const stage = d.stage ?? "";
    if (!NON_TERMINAL_STAGES.has(stage)) continue;
    const updated = d.updatedAt ? new Date(d.updatedAt).getTime() : NaN;
    if (Number.isNaN(updated)) continue;
    const daysStalled = Math.floor((Date.now() - updated) / 86_400_000);
    if (daysStalled < STALLED_DAYS) continue;
    const face = Number(d.faceValueUsd) || 0;
    const label = `${d.ticker || d.brokerName || "Deal"} stalled ${daysStalled}d in ${stage}`;
    const detail =
      stage === "bidding"
        ? `Broker is waiting for your bid. ${face > 0 ? `${fmtUsd(face)} face. ` : ""}Decide or walk.`
        : `${face > 0 ? `${fmtUsd(face)} face. ` : ""}Move it forward, demote, or close out.`;
    items.push({
      id: `pipeline_stalled_${d.id ?? `${d.ticker}_${updated}`}`,
      // Bidding stage stalled = high (revenue at stake); other stages = medium
      severity: stage === "bidding" ? "high" : "medium",
      pillar: "pipeline",
      icon: "→",
      label,
      detail,
      faceDollars: face,
      daysContext: -daysStalled,
      action: { href: "/app/pipeline", label: "Open pipeline →" },
    });
  }

  // Sort: critical first, then high, then medium. Within tier, oldest
  // window first (most negative daysContext) or biggest faceDollars.
  const severityOrder: Record<UrgencySeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };
  items.sort((a, b) => {
    const s = severityOrder[a.severity] - severityOrder[b.severity];
    if (s !== 0) return s;
    const aDays = a.daysContext ?? 9999;
    const bDays = b.daysContext ?? 9999;
    if (aDays !== bDays) return aDays - bDays;
    return (b.faceDollars ?? 0) - (a.faceDollars ?? 0);
  });

  return items;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UrgentQueue() {
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<UrgentItem[]>([]);

  function recompute() {
    setItems(buildItems());
  }

  useEffect(() => {
    recompute();
    setHydrated(true);
    function onStorage() {
      recompute();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const headlineTone = useMemo(() => {
    if (items.some((i) => i.severity === "critical")) return "var(--color-danger)";
    if (items.some((i) => i.severity === "high")) return "var(--color-warn)";
    return "var(--color-fg-faint)";
  }, [items]);

  if (!hydrated) return null;
  if (items.length === 0) return null; // silent when nothing urgent

  // The LicenseExpiryBanner above already shows license-only items in
  // dense per-state form. To avoid duplication, this unified queue
  // only renders when there's at least one non-license urgency
  // (returns, capital). When that's the case, we still include the
  // license items in the queue so the ranked view is complete.
  const hasNonLicense = items.some((i) => i.pillar !== "compliance");
  if (!hasNonLicense) return null;

  const critical = items.filter((i) => i.severity === "critical").length;
  const high = items.filter((i) => i.severity === "high").length;
  const medium = items.filter((i) => i.severity === "medium").length;

  return (
    <section className="mb-6 border bg-[color:var(--color-bg-1)] rounded-xl p-4" style={{ borderColor: headlineTone }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.18em] uppercase font-semibold"
            style={{ background: headlineTone, color: "var(--color-bg)" }}
          >
            {items.length} urgent
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Across pillars
          </span>
          {critical > 0 && (
            <span className="font-mono text-[10px] text-[color:var(--color-danger)]">
              {critical} critical
            </span>
          )}
          {high > 0 && (
            <span className="font-mono text-[10px] text-[color:var(--color-warn)]">
              {high} high
            </span>
          )}
          {medium > 0 && (
            <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)]">
              {medium} med
            </span>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.slice(0, 8).map((i) => (
          <UrgentRow key={i.id} item={i} />
        ))}
      </ul>
      {items.length > 8 && (
        <p className="mt-2 text-[11px] text-[color:var(--color-fg-faint)] italic">
          +{items.length - 8} more — open the pillar pages to triage.
        </p>
      )}
    </section>
  );
}

function UrgentRow({ item }: { item: UrgentItem }) {
  const sevColor =
    item.severity === "critical"
      ? "var(--color-danger)"
      : item.severity === "high"
      ? "var(--color-warn)"
      : "var(--color-fg-dim)";
  return (
    <li className="flex items-baseline gap-3 py-1.5 border-b border-[color:var(--color-line)] last:border-0">
      <span
        className="font-mono text-[11px] w-4 text-center shrink-0"
        style={{ color: sevColor }}
        aria-hidden
      >
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] text-[color:var(--color-fg)] font-medium">
            {item.label}
          </span>
          <span className="font-mono text-[10px] tracking-[0.05em] uppercase text-[color:var(--color-fg-faint)]">
            {item.pillar}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-[color:var(--color-fg-dim)] leading-snug">
          {item.detail}
        </p>
      </div>
      <Link
        href={item.action.href}
        className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition shrink-0 self-center"
      >
        {item.action.label}
      </Link>
    </li>
  );
}
