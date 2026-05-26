"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readCapitalState } from "@/lib/capital";
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
  type HoldingForReturns,
} from "@/lib/returns-tracker";

// Floating bottom-right chip that surfaces NEW urgent spine items on
// every /app/* page. Once the operator acknowledges or visits /app/today
// for that specific item, the chip won't re-fire — unless the underlying
// situation changes severity tier (e.g., a license that was "expiring
// soon" becomes "expired" gets a new ack key and re-surfaces).
//
// Sources: compliance licenses, returns tracker, capital state. All client-
// side localStorage reads (no fetches). Recomputes on storage events and
// every 5 minutes (catches day-bucket transitions like license going
// from 30d→29d remaining).

type UrgencySeverity = "critical" | "high";

type UrgentItem = {
  ackKey: string; // stable per (item × severity-tier) — re-fires when tier shifts
  severity: UrgencySeverity;
  pillar: "compliance" | "returns" | "capital";
  label: string; // 1-line headline
  detail: string; // sub-line
  action: { href: string; label: string };
};

const ACKS_STORAGE_KEY = "tradeline.urgent-acks.v1";
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

function readAcks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(ACKS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeAcks(acks: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACKS_STORAGE_KEY, JSON.stringify(Array.from(acks)));
  } catch {}
}

function buildUrgentItems(): UrgentItem[] {
  if (typeof window === "undefined") return [];
  const out: UrgentItem[] = [];

  // Compliance
  const licenses: License[] = readLicenses();
  for (const l of expiredLicenses(licenses)) {
    const ago = Math.abs(daysUntil(l.expirationDate));
    out.push({
      ackKey: `license_expired:${l.id}`,
      severity: "critical",
      pillar: "compliance",
      label: `${l.state} ${l.licenseType} license LAPSED`,
      detail: `Expired ${ago}d ago — outreach + bids to ${l.state} are now blocked`,
      action: { href: "/app/compliance", label: "Renew" },
    });
  }
  for (const l of expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS)) {
    const days = daysUntil(l.expirationDate);
    // Bucket the ack key so a "30d remaining" ack doesn't suppress a
    // "7d remaining" alert later.
    const bucket = days <= 7 ? "7" : days <= 14 ? "14" : "30";
    out.push({
      ackKey: `license_expiring:${l.id}:${bucket}`,
      severity: days <= 7 ? "critical" : "high",
      pillar: "compliance",
      label: `${l.state} ${l.licenseType} license expires in ${days}d`,
      detail: `State renewal takes 30-60d — start paperwork now`,
      action: { href: "/app/compliance", label: "Open renewal" },
    });
  }

  // Returns
  const returnsRecords = readReturns();
  if (returnsRecords.length > 0) {
    const holdings = readHoldingsForReturns();
    const holdingsById = new Map<string, HoldingForReturns>();
    for (const h of holdings) holdingsById.set(h.id, h);
    const report = buildReturnsReport(returnsRecords, holdingsById);
    for (const r of report.urgentReturns) {
      const refund = r.refundExpectedUsd ?? r.refundExpectedAuto;
      const isExpired = r.urgencyTier === "expired";
      out.push({
        ackKey: isExpired
          ? `return_expired:${r.id}`
          : `return_critical:${r.id}:${Math.max(0, Math.min(14, r.daysRemaining ?? 14))}`,
        severity: isExpired ? "critical" : "high",
        pillar: "returns",
        label: isExpired
          ? `Return window EXPIRED — ${fmtUsdShort(refund)} refund at risk`
          : `Return due in ${r.daysRemaining ?? 0}d — ${fmtUsdShort(refund)} refund`,
        detail: isExpired
          ? `Send notice immediately; some sellers honor late returns in good faith`
          : `Send return notice this week — sellers reject late by 1 day`,
        action: { href: "/app/portfolio", label: "Send notice" },
      });
    }
  }

  // Capital
  try {
    const cap = readCapitalState();
    if (cap.configured && cap.available < 0) {
      // Bucket by 10k chunks so a small over-commit ack doesn't suppress
      // a much-larger one later.
      const bucket = Math.floor(Math.abs(cap.available) / 10_000);
      out.push({
        ackKey: `capital_overcommit:${bucket}`,
        severity: "high",
        pillar: "capital",
        label: `Capital over-committed by ${fmtUsdShort(Math.abs(cap.available))}`,
        detail: `Drop a live bid, raise capital, or walk a deal`,
        action: { href: "/app/capital", label: "Open capital" },
      });
    }
  } catch {}

  // Sort critical-first
  out.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "critical" ? -1 : 1;
  });
  return out;
}

function fmtUsdShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function UrgentNotificationPing() {
  const [hydrated, setHydrated] = useState(false);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<UrgentItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  // Session-only dismissal so operator can hide the chip for THIS page
  // without permanently acking each item.
  const [hiddenThisSession, setHiddenThisSession] = useState(false);

  function recompute() {
    setAcked(readAcks());
    setItems(buildUrgentItems());
  }

  useEffect(() => {
    recompute();
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (
        e.key === null ||
        e.key === ACKS_STORAGE_KEY ||
        e.key === "tradeline.compliance.licenses.v1" ||
        e.key === "tradeline.returns.v1" ||
        e.key === PORTFOLIO_KEY ||
        e.key === "tradeline.pipeline.deals.v1" ||
        e.key === "tradeline.capital.config.v1"
      ) {
        recompute();
      }
    }
    window.addEventListener("storage", onStorage);
    const t = setInterval(recompute, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);

  const visible = useMemo(
    () => items.filter((i) => !acked.has(i.ackKey)),
    [items, acked]
  );

  function ackItem(key: string) {
    const next = new Set(acked);
    next.add(key);
    writeAcks(next);
    setAcked(next);
  }

  function ackAll() {
    const next = new Set(acked);
    for (const i of visible) next.add(i.ackKey);
    writeAcks(next);
    setAcked(next);
    setExpanded(false);
  }

  if (!hydrated || hiddenThisSession || visible.length === 0) return null;

  const critical = visible.filter((i) => i.severity === "critical").length;
  const tone = critical > 0 ? "var(--color-danger)" : "var(--color-warn)";
  const top = visible[0];

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-lg border bg-[color:var(--color-bg-1)] hover:shadow-xl transition-shadow"
          style={{ borderColor: tone }}
          title={`${visible.length} urgent · click to expand`}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: tone }}
          />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase font-semibold" style={{ color: tone }}>
            {visible.length} urgent
          </span>
          <span className="text-[11.5px] text-[color:var(--color-fg-dim)] truncate max-w-[18ch]">
            {top.label}
          </span>
        </button>
      )}
      {expanded && (
        <div
          className="rounded-xl border bg-[color:var(--color-bg-1)] shadow-xl overflow-hidden"
          style={{ borderColor: tone }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[color:var(--color-line)]">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: tone }}
              />
              <span
                className="font-mono text-[10px] tracking-[0.18em] uppercase font-semibold"
                style={{ color: tone }}
              >
                {visible.length} urgent · {critical} critical
              </span>
            </div>
            <button
              type="button"
              onClick={() => setHiddenThisSession(true)}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
              title="Hide until next page load — doesn't acknowledge"
            >
              hide
            </button>
          </div>
          <ul className="max-h-[320px] overflow-y-auto">
            {visible.slice(0, 6).map((i) => (
              <li
                key={i.ackKey}
                className="px-3 py-2 border-b border-[color:var(--color-line)] last:border-0"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono text-[9px] tracking-[0.05em] uppercase font-semibold shrink-0"
                    style={{ color: i.severity === "critical" ? "var(--color-danger)" : "var(--color-warn)" }}
                  >
                    {i.severity}
                  </span>
                  <span className="text-[12px] text-[color:var(--color-fg)] font-medium flex-1 min-w-0">
                    {i.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[color:var(--color-fg-dim)] leading-snug">
                  {i.detail}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={i.action.href}
                    onClick={() => setExpanded(false)}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full text-[#0a0c14] hover:opacity-90 transition"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {i.action.label} →
                  </Link>
                  <button
                    type="button"
                    onClick={() => ackItem(i.ackKey)}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] hover:text-[color:var(--color-fg)] transition"
                  >
                    Ack
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[color:var(--color-line)] bg-[color:var(--color-bg)]">
            {visible.length > 6 && (
              <Link
                href="/app/today"
                onClick={() => setExpanded(false)}
                className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
              >
                +{visible.length - 6} more at /app/today
              </Link>
            )}
            <button
              type="button"
              onClick={ackAll}
              className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
            >
              Ack all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
