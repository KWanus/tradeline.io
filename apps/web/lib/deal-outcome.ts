"use client";

/**
 * Credits a pipeline win/loss back to the most-recent matching outreach in
 * the autopilot log. Fired from pipeline-board stage transitions — when a
 * deal flips to "won", the bank that sourced it gets a won_deal outcome
 * tag, which feeds pattern-performance's lift calculation.
 *
 * bankKey resolution: explicit field wins; falls back to ticker for SEC
 * deals (where ticker IS the bankKey). FDIC/NCUA deals without a bankKey
 * silently no-op — appendOutcome's "no matching sent entry" path catches
 * them server-side without surfacing an error to the operator.
 *
 * Best-effort: network failures are swallowed. The operator's visible
 * action (advancing the deal) succeeds regardless.
 */

type Stage =
  | "sourced"
  | "reviewing"
  | "underwriting"
  | "bidding"
  | "won"
  | "lost"
  | "walked";

type DealLike = {
  bankKey?: string;
  ticker?: string;
};

export async function creditDealOutcome(
  prevStage: Stage | undefined,
  nextStage: Stage,
  deal: DealLike
): Promise<void> {
  if (prevStage === nextStage) return;
  const outcome =
    nextStage === "won"
      ? "won_deal"
      : nextStage === "lost"
        ? "lost_deal"
        : null;
  if (!outcome) return;

  const bankKey = (deal.bankKey || deal.ticker || "").trim();
  if (!bankKey) return;

  try {
    await fetch("/api/outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankKey, outcome }),
    });
  } catch {}
}
