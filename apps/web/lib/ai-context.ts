"use client";

import { type BuyerProfile, profileSystemContext } from "./buyer-profile";
import { readOutreach, readWatchlist } from "./bank-state";
import { readDeals } from "./pipeline";
import { buildSpineContext } from "./spine-context";
import { formatActivityForAi } from "./activity-log";

// Builds the per-turn "About this user" context block that gets injected
// into the AI's system prompt. Combines:
//   - profile (firm, license, bond, servicer)
//   - watchlist (which banks they care about)
//   - outreach log (last 10, who they've emailed)
//   - pipeline (deal counts by stage)
//   - bank context (when navigating from a bank detail page)

type BankContext = {
  ticker: string;
  bank: string;
  signal?: string | null;
  yoy?: number | null;
};

export function buildAiUserContext(
  profile: BuyerProfile,
  bankContext: BankContext | null
): string {
  const parts: string[] = [profileSystemContext(profile)];

  // Watchlist
  const watch = typeof window !== "undefined" ? readWatchlist() : [];
  if (watch.length > 0) {
    parts.push(
      `## Watchlist (banks the user has starred)\n${watch.join(", ")}`
    );
  }

  // Outreach log (last 10)
  const outreach = typeof window !== "undefined" ? readOutreach() : [];
  if (outreach.length > 0) {
    const recent = outreach
      .slice(-10)
      .reverse()
      .map((e) => {
        const days = Math.floor(
          (Date.now() - new Date(e.sentAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        return `- ${e.ticker} → ${e.brokerShortName} (${days}d ago)`;
      })
      .join("\n");
    parts.push(`## Recent outreach (latest 10)\n${recent}`);
  }

  // Pipeline summary
  const deals = typeof window !== "undefined" ? readDeals() : [];
  if (deals.length > 0) {
    const byStage: Record<string, number> = {};
    for (const d of deals) byStage[d.stage] = (byStage[d.stage] || 0) + 1;
    const stageSummary = Object.entries(byStage)
      .map(([s, n]) => `${s}: ${n}`)
      .join(", ");
    const active = deals
      .filter((d) => !["won", "lost", "walked"].includes(d.stage))
      .slice(0, 6)
      .map(
        (d) =>
          `- ${d.ticker} (${d.stage}, ${d.brokerName}, ${d.assetClass}${
            d.faceValueUsd ? `, $${(d.faceValueUsd / 1_000_000).toFixed(1)}M face` : ""
          })`
      )
      .join("\n");
    parts.push(
      `## Pipeline (${deals.length} total deals — ${stageSummary})\n${
        active || "All deals closed/walked."
      }`
    );
  }

  // Operator OS state — compliance / capital / returns / portfolio rollup.
  // Surfaces the most actionable spine signals to the model so morning
  // briefing + tutor can recommend concrete next steps (renew license,
  // send return notice, top up capital, etc.) instead of only radar moves.
  const spine = typeof window !== "undefined" ? buildSpineContext() : "";
  if (spine) parts.push(spine);

  // Recent activity — temporal awareness so the model can reference
  // "you decoded a CA-heavy tape 2h ago" or "you bumped FLG to bidding"
  // instead of only static state. Last 15 actions across all pillars.
  const activity = typeof window !== "undefined" ? formatActivityForAi(15) : "";
  if (activity) parts.push(activity);

  // Bank context (when navigated from a bank detail page)
  if (bankContext && bankContext.ticker) {
    const ctxParts = [
      `## Current page context`,
      "",
      `The user just navigated here from /app/banks/${bankContext.ticker} (${bankContext.bank}). Likely intent: rehearsing the broker call, drafting outreach, or asking how to handle this specific bank's signal.`,
    ];
    if (bankContext.signal) {
      ctxParts.push(
        `Current signal on ${bankContext.ticker}: ${bankContext.signal}${
          bankContext.yoy ? ` (+${bankContext.yoy}% YoY)` : ""
        }.`
      );
    }
    ctxParts.push(
      'When answering, reference this bank by name and signal. If the user asks vaguely ("draft the email", "what should I say"), assume they mean about this bank.'
    );
    parts.push(ctxParts.join("\n"));
  }

  return parts.filter(Boolean).join("\n\n");
}
