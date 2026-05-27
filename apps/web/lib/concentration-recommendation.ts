"use client";

// Concentration policy recommendation.
//
// Operator sets a concentration policy ("max 60% per asset class") once,
// then their book grows past it because they keep buying CC paper. The
// policy lapses into a fiction. This module compares CURRENT book
// concentration against the configured policy and emits structured
// recommendations: either revise the policy upward (if the operator
// genuinely wants this concentration) or tighten future bid behavior.
//
// Pure heuristic over (holdings, policy). No LLM call.

import type { ConcentrationPolicy } from "./tape-concentration-policy";

export type RecommendationKind = "ok" | "revise_policy" | "tighten_bidding";

export type ConcentrationRecommendation = {
  dimension: "state" | "vintage" | "asset_class";
  key: string;
  currentPct: number;
  policyLimit: number;
  overagePts: number; // currentPct - policyLimit
  kind: RecommendationKind;
  suggestedNewLimitPct?: number; // when kind = revise_policy
  message: string;
};

export type ConcentrationRecommendationReport = {
  policyConfigured: boolean;
  recommendations: ConcentrationRecommendation[];
  headline: string;
};

type HoldingForRecommendation = {
  faceValueUsd: number;
  assetClass: string;
  vintageYear?: number;
  // state isn't tracked at the holding level today (state lives in tape
  // distribution); skip the per-state dimension until we model it.
};

function pctOf(face: number, total: number): number {
  return total > 0 ? (face / total) * 100 : 0;
}

function groupSumByFace<K extends string | number>(
  holdings: HoldingForRecommendation[],
  keyFn: (h: HoldingForRecommendation) => K | null
): Map<K, number> {
  const out = new Map<K, number>();
  for (const h of holdings) {
    const k = keyFn(h);
    if (k === null) continue;
    out.set(k, (out.get(k) ?? 0) + (h.faceValueUsd || 0));
  }
  return out;
}

// Round up to the next 5-percent step for a clean revised limit.
function suggestRevisedLimit(currentPct: number): number {
  return Math.min(100, Math.ceil((currentPct + 5) / 5) * 5);
}

export function computeConcentrationRecommendations(input: {
  holdings: HoldingForRecommendation[];
  policy: ConcentrationPolicy | null;
}): ConcentrationRecommendationReport {
  if (!input.policy) {
    return {
      policyConfigured: false,
      recommendations: [],
      headline: "No concentration policy configured. Set one in Tape Copilot to see recommendations.",
    };
  }
  const totalFace = input.holdings.reduce((s, h) => s + (h.faceValueUsd || 0), 0);
  if (totalFace === 0) {
    return {
      policyConfigured: true,
      recommendations: [],
      headline: "No holdings yet — recommendations appear once your book accumulates face value.",
    };
  }

  const recs: ConcentrationRecommendation[] = [];

  // Asset-class dimension
  if (input.policy.maxPctPerAssetClass !== null) {
    const limit = input.policy.maxPctPerAssetClass;
    const byClass = groupSumByFace(input.holdings, (h) => h.assetClass || "Unspecified");
    for (const [cls, face] of byClass) {
      const pct = pctOf(face, totalFace);
      if (pct <= limit) continue;
      const overage = pct - limit;
      // If overage is small (<5pt), recommend tightening future bids
      // (the operator likely just nudged over). If big, recommend revising
      // policy upward to match reality.
      const kind: RecommendationKind = overage < 5 ? "tighten_bidding" : "revise_policy";
      const suggestedLimit = kind === "revise_policy" ? suggestRevisedLimit(pct) : undefined;
      recs.push({
        dimension: "asset_class",
        key: cls,
        currentPct: pct,
        policyLimit: limit,
        overagePts: overage,
        kind,
        suggestedNewLimitPct: suggestedLimit,
        message:
          kind === "revise_policy"
            ? `${cls} is ${pct.toFixed(0)}% of your book (cap ${limit}%). Either revise the cap to ${suggestedLimit}% or actively diversify — winning the next ${cls} tape worsens this.`
            : `${cls} is ${pct.toFixed(0)}% of your book vs ${limit}% cap. Marginally over — pass on the next ${cls} bid OR raise the cap slightly.`,
      });
    }
  }

  // Vintage dimension
  if (input.policy.maxPctPerVintage !== null) {
    const limit = input.policy.maxPctPerVintage;
    const byVintage = groupSumByFace(input.holdings, (h) =>
      h.vintageYear ? String(h.vintageYear) : null
    );
    for (const [year, face] of byVintage) {
      const pct = pctOf(face, totalFace);
      if (pct <= limit) continue;
      const overage = pct - limit;
      const kind: RecommendationKind = overage < 5 ? "tighten_bidding" : "revise_policy";
      const suggestedLimit = kind === "revise_policy" ? suggestRevisedLimit(pct) : undefined;
      recs.push({
        dimension: "vintage",
        key: year,
        currentPct: pct,
        policyLimit: limit,
        overagePts: overage,
        kind,
        suggestedNewLimitPct: suggestedLimit,
        message:
          kind === "revise_policy"
            ? `Vintage ${year} is ${pct.toFixed(0)}% of your book (cap ${limit}%). Either revise the cap to ${suggestedLimit}% or push for older/newer paper to balance.`
            : `Vintage ${year} sits at ${pct.toFixed(0)}% vs ${limit}% cap. Marginal — be selective on next bid in that vintage.`,
      });
    }
  }

  // Sort by overage descending
  recs.sort((a, b) => b.overagePts - a.overagePts);

  let headline: string;
  if (recs.length === 0) {
    headline = "Book is within policy on every dimension. Concentration discipline intact.";
  } else {
    const reviseCount = recs.filter((r) => r.kind === "revise_policy").length;
    const tightenCount = recs.filter((r) => r.kind === "tighten_bidding").length;
    const parts: string[] = [];
    if (reviseCount > 0) parts.push(`${reviseCount} need policy revision`);
    if (tightenCount > 0) parts.push(`${tightenCount} need bid discipline`);
    headline = `${recs.length} dimension${recs.length === 1 ? "" : "s"} over policy — ${parts.join(", ")}.`;
  }

  return {
    policyConfigured: true,
    recommendations: recs,
    headline,
  };
}
