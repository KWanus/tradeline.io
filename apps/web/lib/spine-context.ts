"use client";

// Spine context — compact text summary of the operator-OS stores for
// inclusion in AI userContext (briefing, tutor, future surfaces).
//
// Reads localStorage directly (client-only). Pure aggregation, no side
// effects. Kept tight (~ <500 tokens worth of text) so the prompt stays
// affordable and the model isn't drowning in detail.

import { readTotalCapital, readCapitalState } from "./capital";
import {
  activeLicensedStates,
  expiredLicenses,
  expiringWithinDays,
  licenseStatus,
  readLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
  type License,
} from "./compliance-licenses";
import {
  buildReturnsReport,
  readReturns,
  type HoldingForReturns,
} from "./returns-tracker";
import {
  readConcentrationPolicy,
} from "./tape-concentration-policy";
import {
  recommendLicensesFromDecodes,
} from "./activity-log";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type RawHolding = {
  id?: string;
  ticker?: string;
  seller?: string;
  servicer?: string;
  assetClass?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  vintageYear?: number;
  purchaseDate?: string;
  cumulativeCollectedUsd?: number;
};

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
      servicer: String(h.servicer ?? ""),
      assetClass: String(h.assetClass ?? ""),
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

export function buildSpineContext(): string {
  if (typeof window === "undefined") return "";

  const sections: string[] = [];

  // ----- COMPLIANCE -----
  const licenses: License[] = readLicenses();
  if (licenses.length > 0) {
    const expired = expiredLicenses(licenses);
    const urgent = expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS);
    const active = licenses.filter((l) => licenseStatus(l) === "active").length;
    const lines: string[] = [];
    lines.push(`Total licenses: ${licenses.length} (${active} active, ${urgent.length} expiring ≤${URGENT_EXPIRY_THRESHOLD_DAYS}d, ${expired.length} EXPIRED)`);
    if (expired.length > 0) {
      const list = expired
        .slice(0, 5)
        .map((l) => `${l.state}/${l.licenseType}`)
        .join(", ");
      lines.push(`LAPSED states: ${list}${expired.length > 5 ? ` (+${expired.length - 5} more)` : ""} — outreach + bids to these states will be BLOCKED by the compliance shield.`);
    }
    if (urgent.length > 0) {
      const next = urgent[0];
      const days = Math.floor(
        (new Date(next.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      lines.push(`Next renewal: ${next.state} ${next.licenseType} in ${days}d (${next.expirationDate}). State processing usually takes 30-60d.`);
    }
    sections.push(`## Compliance state\n${lines.join("\n")}`);
  }

  // ----- LICENSE RECOMMENDATIONS (activity-driven) -----
  // States that show up in operator's recent tape decodes but aren't on
  // their license map — surfaced so the briefing can recommend licensing
  // them as a "Today's move" when face value justifies the lift.
  const licensedStateCodes = activeLicensedStates(licenses);
  const recommendations = recommendLicensesFromDecodes({
    licensedStates: licensedStateCodes,
    limit: 3, // briefing context only needs top few
  });
  if (recommendations.length > 0) {
    const recLines: string[] = recommendations.map(
      (r) =>
        `- ${r.state}: ${r.decodeCount} tape${r.decodeCount === 1 ? "" : "s"} evaluated, ${fmtUsdShort(r.totalFaceUsd)} total face (last ${Math.floor((Date.now() - new Date(r.mostRecentDecode).getTime()) / 86_400_000)}d ago)`
    );
    sections.push(
      `## License recommendations (from your deal flow, last 90d)\n${recLines.join("\n")}\n\nThese states aren't on your license map but your recent decodes have material face there. Consider licensing if the face justifies the renewal lift.`
    );
  }

  // ----- CAPITAL -----
  const totalCapital = readTotalCapital();
  if (totalCapital > 0) {
    const cap = readCapitalState();
    const lines: string[] = [];
    lines.push(`Total: ${fmtUsdShort(cap.total)} · Deployed: ${fmtUsdShort(cap.deployed)} · Live bids: ${fmtUsdShort(cap.committed)} · Available: ${fmtUsdShort(cap.available)}`);
    if (cap.available < 0) {
      lines.push(`OVER-COMMITTED by ${fmtUsdShort(Math.abs(cap.available))}. Winning every live bid would leave the operator unable to fund deployed positions.`);
    } else if (cap.total > 0 && cap.available / cap.total < 0.1) {
      lines.push(`Available <10% of total — bid envelope is tight this week.`);
    }
    sections.push(`## Capital state\n${lines.join("\n")}`);
  }

  // ----- CONCENTRATION POLICY -----
  const concPolicy = readConcentrationPolicy();
  if (concPolicy) {
    const parts: string[] = [];
    if (concPolicy.maxPctPerState !== null) parts.push(`state ≤${concPolicy.maxPctPerState}%`);
    if (concPolicy.maxPctPerVintage !== null) parts.push(`vintage ≤${concPolicy.maxPctPerVintage}%`);
    if (concPolicy.maxPctPerAssetClass !== null) parts.push(`asset ≤${concPolicy.maxPctPerAssetClass}%`);
    if (parts.length > 0) {
      sections.push(`## Concentration policy\n${parts.join(" · ")}${concPolicy.notes ? ` (${concPolicy.notes})` : ""}`);
    }
  }

  // ----- RETURNS -----
  const returnsRecords = readReturns();
  if (returnsRecords.length > 0) {
    const holdings = readHoldings();
    const holdingsById = new Map<string, HoldingForReturns>();
    for (const h of holdings) holdingsById.set(h.id, h);
    const report = buildReturnsReport(returnsRecords, holdingsById);
    const lines: string[] = [];
    lines.push(
      `Open: ${report.countByStatus.flagged + report.countByStatus.contacted} · Returned: ${report.countByStatus.returned} · Expired window: ${report.countByStatus.expired}`
    );
    lines.push(
      `Refund expected: ${fmtUsdShort(report.totalRefundExpectedUsd)} · Recovered: ${fmtUsdShort(report.totalRefundReceivedUsd)}`
    );
    if (report.urgentReturns.length > 0) {
      const oldest = report.urgentReturns[0];
      const desc =
        oldest.urgencyTier === "expired"
          ? `${Math.abs(oldest.daysRemaining ?? 0)}d PAST window`
          : `${oldest.daysRemaining ?? 0}d remaining`;
      lines.push(
        `URGENT: ${report.urgentReturns.length} return(s) within 14d/expired. Oldest: ${desc} (${fmtUsdShort(oldest.refundExpectedUsd ?? oldest.refundExpectedAuto)} refund).`
      );
    }
    sections.push(`## Returns queue\n${lines.join("\n")}`);
  }

  // ----- PORTFOLIO ROLLUP -----
  const holdings = readHoldings();
  if (holdings.length > 0) {
    const totalFace = holdings.reduce((s, h) => s + (h.faceValueUsd || 0), 0);
    const totalPaid = holdings.reduce((s, h) => s + (h.purchasePriceUsd || 0), 0);
    const lines: string[] = [];
    lines.push(`Holdings: ${holdings.length} · Total face: ${fmtUsdShort(totalFace)} · Total paid: ${fmtUsdShort(totalPaid)}`);
    // Asset-class breakdown
    const byClass = new Map<string, number>();
    for (const h of holdings) {
      const k = h.assetClass || "Unspecified";
      byClass.set(k, (byClass.get(k) ?? 0) + (h.faceValueUsd || 0));
    }
    const breakdown = Array.from(byClass.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${k} ${totalFace > 0 ? Math.round((v / totalFace) * 100) : 0}%`)
      .join(", ");
    if (breakdown) lines.push(`Asset mix: ${breakdown}`);
    sections.push(`## Portfolio rollup\n${lines.join("\n")}`);
  }

  if (sections.length === 0) {
    return "## Operator OS state\nNot configured yet. Encourage the user to set up via the OS setup card at /app/today (capital + license states + concentration policy) so the spine produces real signal.";
  }
  return `## Operator OS state\n\n${sections.join("\n\n")}`;
}
