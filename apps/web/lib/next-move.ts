"use client";

// Heuristic "your single highest-impact next move" recommendation.
//
// The urgent queue is exhaustive (a triage list); the AI briefing's
// three-moves is a daily synthesis. This module emits ONE recommendation:
// the single most-leveraged action the operator could take right now,
// derived from a stack-rank over the whole spine state.
//
// Pure function — no LLM call, no fetch. Reads localStorage stores
// directly so the recommendation refreshes instantly when state changes.

import { readCapitalState } from "./capital";
import {
  daysUntil,
  expiredLicenses,
  expiringWithinDays,
  readLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
} from "./compliance-licenses";
import {
  buildReturnsReport,
  readReturns,
  type HoldingForReturns,
} from "./returns-tracker";
import {
  readActivityLog,
  recommendLicensesFromDecodes,
} from "./activity-log";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";
const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

export type NextMoveSeverity = "critical" | "high" | "medium";

export type NextMove = {
  severity: NextMoveSeverity;
  pillar: "compliance" | "returns" | "capital" | "pipeline" | "tape";
  // 1-line headline ("Renew VA license now").
  label: string;
  // 1-2 sentences explaining why this is THE top move.
  why: string;
  // Quantified impact ("$42k refund at risk", "blocks 14% of tape face")
  impact?: string;
  action: { href: string; label: string };
};

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

function fmtUsdShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

// Stack-ranked rule evaluation. Returns the FIRST move that qualifies —
// implicit priority order from top to bottom. Returns null when nothing
// rises above the noise (early-state operator with empty stores).
export function computeNextMove(): NextMove | null {
  if (typeof window === "undefined") return null;

  // 1. EXPIRED LICENSE → critical (blocks revenue on those states)
  const licenses = readLicenses();
  const expired = expiredLicenses(licenses);
  if (expired.length > 0) {
    const top = expired[0];
    const daysAgo = Math.abs(daysUntil(top.expirationDate));
    return {
      severity: "critical",
      pillar: "compliance",
      label: `Renew ${top.state} ${top.licenseType} license now`,
      why: `License lapsed ${daysAgo}d ago. The compliance shield is blocking outreach + bids to ${top.state} until you renew. Every day uncovered is revenue you can't pursue.`,
      impact: `${expired.length} state${expired.length === 1 ? "" : "s"} lapsed`,
      action: { href: "/app/compliance", label: "Renew →" },
    };
  }

  // 2. RETURN PAST WINDOW → critical (refund $ at risk)
  const returnsRecords = readReturns();
  if (returnsRecords.length > 0) {
    const holdings = readHoldingsForReturns();
    const holdingsById = new Map<string, HoldingForReturns>();
    for (const h of holdings) holdingsById.set(h.id, h);
    const report = buildReturnsReport(returnsRecords, holdingsById);
    const expiredReturns = report.urgentReturns.filter((r) => r.urgencyTier === "expired");
    if (expiredReturns.length > 0) {
      const top = expiredReturns[0];
      const refund = top.refundExpectedUsd ?? top.refundExpectedAuto;
      return {
        severity: "critical",
        pillar: "returns",
        label: `Send return notice for ${fmtUsdShort(refund)} (window past)`,
        why: `Return window expired ${Math.abs(top.daysRemaining ?? 0)}d ago. Some sellers still honor late returns in good faith — send the notice now while there's any chance of recovery.`,
        impact: `${fmtUsdShort(refund)} refund at risk · ${expiredReturns.length} expired return${expiredReturns.length === 1 ? "" : "s"}`,
        action: { href: "/app/portfolio", label: "Open returns →" },
      };
    }
  }

  // 3. LICENSE EXPIRING <7 days → high (state processing takes 30-60d, you're already late)
  const expiringSoon = expiringWithinDays(licenses, 7);
  if (expiringSoon.length > 0) {
    const top = expiringSoon[0];
    const days = daysUntil(top.expirationDate);
    return {
      severity: "critical",
      pillar: "compliance",
      label: `Start renewal NOW — ${top.state} ${top.licenseType} expires in ${days}d`,
      why: `State renewal processing typically takes 30-60 days. You're already past the safe window — the license will lapse before processing completes unless you fast-track today.`,
      impact: `${days}d to deadline`,
      action: { href: "/app/compliance", label: "Open renewal →" },
    };
  }

  // 4. CAPITAL OVER-COMMITTED → high
  try {
    const cap = readCapitalState();
    if (cap.configured && cap.available < 0) {
      const over = Math.abs(cap.available);
      return {
        severity: "high",
        pillar: "capital",
        label: `Right-size capital: over-committed by ${fmtUsdShort(over)}`,
        why: `Owned tapes (${fmtUsdShort(cap.deployed)}) + live bids (${fmtUsdShort(cap.committed)}) exceed total capital. Winning every bid leaves you unable to fund deployed positions — drop a bid, raise capital, or walk a deal before the next one closes.`,
        impact: `${fmtUsdShort(over)} over`,
        action: { href: "/app/capital", label: "Open envelope →" },
      };
    }
  } catch {
    // capital store may not be configured
  }

  // 5. RETURN CRITICAL (≤14d remaining) → high
  if (returnsRecords.length > 0) {
    const holdings = readHoldingsForReturns();
    const holdingsById = new Map<string, HoldingForReturns>();
    for (const h of holdings) holdingsById.set(h.id, h);
    const report = buildReturnsReport(returnsRecords, holdingsById);
    const critical = report.urgentReturns.filter((r) => r.urgencyTier === "critical");
    if (critical.length > 0) {
      const top = critical[0];
      const refund = top.refundExpectedUsd ?? top.refundExpectedAuto;
      return {
        severity: "high",
        pillar: "returns",
        label: `Send return notice this week — ${fmtUsdShort(refund)} refund`,
        why: `Return window closes in ${top.daysRemaining ?? 0}d. Sellers reject late returns even by 1 day. Send the notice today.`,
        impact: `${fmtUsdShort(refund)} refund · ${top.daysRemaining ?? 0}d left`,
        action: { href: "/app/portfolio", label: "Send notice →" },
      };
    }
  }

  // 6. STALLED BIDDING DEAL → high (broker waiting + revenue at stake)
  try {
    const dealsRaw = window.localStorage.getItem(PIPELINE_KEY);
    const deals = dealsRaw ? (JSON.parse(dealsRaw) || []) : [];
    if (Array.isArray(deals)) {
      const stalledBidding = (deals as Array<{
        id?: string;
        ticker?: string;
        brokerName?: string;
        faceValueUsd?: number;
        stage?: string;
        updatedAt?: string;
      }>)
        .filter((d) => d.stage === "bidding" && d.updatedAt)
        .map((d) => ({
          ...d,
          daysStalled: Math.floor(
            (Date.now() - new Date(d.updatedAt as string).getTime()) / 86_400_000
          ),
        }))
        .filter((d) => d.daysStalled >= 14)
        .sort((a, b) => b.daysStalled - a.daysStalled);
      if (stalledBidding.length > 0) {
        const top = stalledBidding[0];
        return {
          severity: "high",
          pillar: "pipeline",
          label: `${top.ticker || top.brokerName || "Bidding deal"} — broker waiting ${top.daysStalled}d`,
          why: `Deal in bidding stage hasn't moved in ${top.daysStalled} days. The broker is waiting for your decision — confirm the bid or walk the deal. Silence is killing the relationship.`,
          impact: top.faceValueUsd ? `${fmtUsdShort(top.faceValueUsd)} face` : undefined,
          action: { href: "/app/pipeline", label: "Open pipeline →" },
        };
      }
    }
  } catch {}

  // 7. LICENSE RECOMMENDATION (≥$500k of evaluated unlicensed face) → medium
  try {
    const licensedStateCodes = licenses
      .filter((l) => {
        const ts = new Date(l.expirationDate).getTime();
        return !Number.isNaN(ts) && ts > Date.now();
      })
      .map((l) => l.state.toUpperCase());
    const recs = recommendLicensesFromDecodes({
      licensedStates: licensedStateCodes,
      minFaceUsd: 500_000,
      limit: 1,
    });
    if (recs.length > 0) {
      const top = recs[0];
      return {
        severity: "medium",
        pillar: "compliance",
        label: `Start ${top.state} license — you've evaluated ${fmtUsdShort(top.totalFaceUsd)} of face there`,
        why: `${top.decodeCount} tape${top.decodeCount === 1 ? "" : "s"} you decoded in the last 90 days had top state ${top.state}, but you're not licensed there. Material face is flowing past your book — license to unlock it.`,
        impact: `${fmtUsdShort(top.totalFaceUsd)} evaluated · ${top.decodeCount} tape${top.decodeCount === 1 ? "" : "s"}`,
        action: { href: "/app/compliance", label: "Open compliance →" },
      };
    }
  } catch {}

  // 8. LICENSE EXPIRING <30d → medium
  const expiringMonth = expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS);
  if (expiringMonth.length > 0) {
    const top = expiringMonth[0];
    const days = daysUntil(top.expirationDate);
    return {
      severity: "medium",
      pillar: "compliance",
      label: `Start renewal for ${top.state} ${top.licenseType} — ${days}d remaining`,
      why: `Most states take 30-60 days to renew. Start the paperwork this week to clear processing before the deadline.`,
      impact: `${days}d to deadline`,
      action: { href: "/app/compliance", label: "Open renewal →" },
    };
  }

  // 9. UNSAVED RECENT DECODE → medium (heuristic: tape_decoded in last 7d
  //    with no matching pipeline deal save in same window)
  try {
    const log = readActivityLog();
    const recent = log.filter(
      (e) =>
        e.type === "tape_decoded" &&
        Date.now() - new Date(e.ts).getTime() <= 7 * 86_400_000
    );
    if (recent.length > 0) {
      // No precise "save to pipeline" event yet — heuristic: if no
      // deals exist created since the most recent decode, the operator
      // likely didn't act on it.
      const lastDecode = recent[0];
      const dealsRaw = window.localStorage.getItem(PIPELINE_KEY);
      const deals = dealsRaw ? (JSON.parse(dealsRaw) || []) : [];
      const dealsSince = Array.isArray(deals)
        ? (deals as Array<{ createdAt?: string }>).filter(
            (d) => d.createdAt && d.createdAt >= lastDecode.ts
          )
        : [];
      if (dealsSince.length === 0) {
        return {
          severity: "medium",
          pillar: "tape",
          label: `Decision on your last decode (${recent.length} this week)`,
          why: `You decoded a tape recently but no pipeline deal was created. Either save it as a deal at the disciplined bid, walk it, or capture why you passed.`,
          action: { href: "/app/tools/tape", label: "Open Tape Copilot →" },
        };
      }
    }
  } catch {}

  // Nothing rose above the noise.
  return null;
}
