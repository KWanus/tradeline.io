// Originator fingerprint detection.
//
// Which optional fields a seller populates — and the exact naming used —
// is highly diagnostic of which upstream issuer/servicer system the tape
// came from. Building this library is a long-term moat: once Tradeline
// has seen enough tapes, the decoder can pre-populate expected schemas,
// flag missing fields the seller usually populates, and warn when a tape
// CLAIMS to be from one originator but smells like another.
//
// V1 seeds the library from public sources:
//   - Spiegel Acceptance → Midland Funding 2007 (SEC EX-10.48)
//   - CompuCredit / Encore "Cut-off Claim Amount" convention
//   - CFPB Encore consent order references
//   - RMAI fintech-asset-class paper (issuer/originator separation)
//
// The library grows automatically as users decode more tapes — each new
// fingerprint becomes another row in the detection table.

import type { SchemaDetection } from "./tape-canonical-schema";

// ---------------------------------------------------------------------------
// Fingerprint types
// ---------------------------------------------------------------------------

export type BalanceConvention =
  // Spiegel-style: account_balance EXCLUDES post-charge-off interest and fees.
  // What you see on the tape is what the consumer owed at charge-off.
  | "exclude_post_co_interest_and_fees"
  // CompuCredit / Encore-style: account_balance INCLUDES pre-charge-off
  // interest, fees, and assessments accrued through charge-off date. The
  // "Cut-off Claim Amount" terminology is the tell.
  | "include_pre_co_interest_and_fees"
  // Encore "Specialized Legal File" subset: ALSO includes post-CO interest
  // because of judgments. Mixed-convention WITHIN one tape.
  | "include_post_co_interest_judgments_only"
  // Unknown — decoder couldn't determine. Warn the operator.
  | "unknown";

export type OriginatorFingerprint = {
  id: string; // stable identifier
  label: string; // human display name
  family: string; // grouping: "issuer", "servicer", "broker", "template"
  // Header tokens that mark this fingerprint (lowercase normalized).
  // Matching is partial: presence of ANY required token is a hit.
  requiredTokens: string[];
  // Tokens that boost confidence when present.
  diagnosticTokens: string[];
  // Tokens whose ABSENCE would be surprising for this fingerprint.
  expectedTokens: string[];
  balanceConvention: BalanceConvention;
  // Surface to operator if detected — context they need at decode time.
  warnings: string[];
  // Source of fingerprint definition.
  source: string;
};

// ---------------------------------------------------------------------------
// Fingerprint library (V1 seeds — grow over time)
// ---------------------------------------------------------------------------

export const ORIGINATOR_FINGERPRINTS: OriginatorFingerprint[] = [
  {
    id: "compucredit_encore_family",
    label: "CompuCredit / Encore family",
    family: "issuer",
    requiredTokens: ["cut_off_claim_amount", "cut-off claim amount", "cutoff claim amount"],
    diagnosticTokens: [
      "approximate_current_balance",
      "approximate current balance",
      "specialized_legal_file",
      "specialized legal file",
    ],
    expectedTokens: [
      "originating_creditor",
      "charge_off_date",
      "last_payment_date",
      "originating creditor",
    ],
    balanceConvention: "include_pre_co_interest_and_fees",
    warnings: [
      "Balance convention: INCLUDES pre-CO interest, fees, and assessments through charge-off date.",
      "This is 10-30% higher than Spiegel-style 'principal-only' tapes — calibrate your bid against this convention, not your usual benchmark.",
      "If 'Specialized Legal File' flag exists, those rows ALSO include post-CO interest from judgments — mixed convention within the tape.",
    ],
    source: "Encore 2005 8-K §1.18 / §3.x; CFPB Encore consent order (2015)",
  },
  {
    id: "spiegel_midland_style",
    label: "Spiegel-style (private-label / Midland-pattern)",
    family: "issuer",
    requiredTokens: ["nfe_account", "nfe account", "first_payment_default"],
    diagnosticTokens: [
      "credit_bureau_referral_name",
      "12_month_payment_history",
      "12-month payment history",
      "12 month payment history",
      "embedded_settlement",
      "embedded settlement",
    ],
    expectedTokens: [
      "account_balance",
      "charge_off_date",
      "last_payment_date",
      "originating_creditor",
      "obligor",
    ],
    balanceConvention: "exclude_post_co_interest_and_fees",
    warnings: [
      "Balance convention: EXCLUDES post-CO interest and fees — what you see is the consumer's debt at charge-off.",
      "'NFE Account' (Not For Enforcement) rows are carved out from forward-flow and require special handling.",
      "Decoder will detect 'First Payment Default' rows separately — these are higher-risk paper.",
    ],
    source: "Spiegel Acceptance → Midland Funding 2007 SEC EX-10.48",
  },
  {
    id: "cardworks_servicer",
    label: "CardWorks-serviced tape",
    family: "servicer",
    requiredTokens: ["cardworks", "card_works", "cw_account"],
    diagnosticTokens: ["servicer_account_number", "sub_servicer", "master_servicer"],
    expectedTokens: ["originating_creditor", "servicer_name"],
    balanceConvention: "unknown",
    warnings: [
      "CardWorks Servicing was the historical servicer for Spiegel/Midland-era private-label cards.",
      "Tape may carry Spiegel-style balance convention even without the 'NFE' tells.",
    ],
    source: "Spiegel-Midland 'Servicer: CardWorks Servicing, LLC'",
  },
  {
    id: "fintech_partner_bank",
    label: "Fintech with partner-bank issuance",
    family: "issuer",
    requiredTokens: [], // no single required token; detected via pattern
    diagnosticTokens: [
      "originator_name",
      "issuing_bank",
      "brand",
      "program_name",
      "partner_bank",
    ],
    expectedTokens: ["originating_creditor", "account_balance", "charge_off_date"],
    balanceConvention: "exclude_post_co_interest_and_fees",
    warnings: [
      "Fintech-issued: the bank-of-record (issuer) likely differs from the consumer-facing brand.",
      "Choice-of-law for arbitration clauses follows the issuing bank, not the brand.",
      "Confirm which entity holds the chain-of-title — fintech sponsorship deals can leave ambiguous ownership.",
    ],
    source: "RMAI Fintech Asset Class paper (2023)",
  },
  {
    id: "broker_reformatted_template",
    label: "Broker-reformatted template (minimal fields)",
    family: "broker",
    requiredTokens: [], // detected via low field count + generic naming
    diagnosticTokens: ["balance", "state", "asset_type", "co_date"],
    expectedTokens: ["account_balance", "state"],
    balanceConvention: "unknown",
    warnings: [
      "This tape appears to have been re-exported by a broker — original seller's field set has been stripped.",
      "Demand the seller's native tape before final bid: critical fields (chain-of-custody, scrubs, exact balance convention) likely exist upstream and were dropped in re-export.",
      "Without the seller's native tape, recovery modeling has 30%+ wider error bars.",
    ],
    source: "Inferred from operator interviews; broker tape-format normalization practice",
  },
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export type FingerprintMatch = {
  fingerprint: OriginatorFingerprint;
  confidence: number; // 0..1
  matchedTokens: string[];
  missingExpected: string[];
};

export type FingerprintDetection = {
  topMatch: FingerprintMatch | null;
  allMatches: FingerprintMatch[]; // sorted desc by confidence
  balanceConvention: BalanceConvention;
  // Cross-checks: if multiple fingerprints match, flag the conflict.
  conflicts: string[];
};

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

export function detectOriginatorFingerprint(
  headers: string[],
  detection: SchemaDetection
): FingerprintDetection {
  const tokenSet = new Set(headers.map(normalizeToken));
  // Also index by canonical names we already detected, so token matches
  // can succeed against canonical-normalized forms.
  const canonicalSet = new Set(detection.byCanonical.keys());

  const matches: FingerprintMatch[] = [];

  for (const fp of ORIGINATOR_FINGERPRINTS) {
    const required = fp.requiredTokens.map(normalizeToken);
    const diagnostic = fp.diagnosticTokens.map(normalizeToken);
    const expected = fp.expectedTokens.map(normalizeToken);

    let requiredHit = required.length === 0; // empty required = pattern-based
    const matchedTokens: string[] = [];
    for (const tok of required) {
      if (tokenSet.has(tok)) {
        requiredHit = true;
        matchedTokens.push(tok);
      }
    }

    // Skip fingerprints whose required tokens aren't met (unless the
    // fingerprint declares no required tokens, in which case we fall
    // through to diagnostic scoring).
    if (!requiredHit) continue;

    let diagnosticHits = 0;
    for (const tok of diagnostic) {
      if (tokenSet.has(tok)) {
        diagnosticHits++;
        matchedTokens.push(tok);
      }
    }

    const missingExpected = expected.filter(
      (tok) => !tokenSet.has(tok) && !canonicalSet.has(tok)
    );

    // Special-case patterns for fingerprints that don't depend on required tokens
    if (required.length === 0 && fp.id === "fintech_partner_bank") {
      // Need originator_name AND originating_creditor (or issuing_bank), and they
      // should be different concepts on the tape.
      const hasOriginator =
        canonicalSet.has("originator_name") ||
        tokenSet.has("originator") ||
        tokenSet.has("brand_name");
      const hasIssuer =
        canonicalSet.has("originating_creditor") ||
        tokenSet.has("issuing_bank") ||
        tokenSet.has("partner_bank");
      if (!(hasOriginator && hasIssuer)) continue;
    }
    if (required.length === 0 && fp.id === "broker_reformatted_template") {
      // Detected when total field count is very low AND naming is generic.
      const totalDetected = detection.byCanonical.size;
      if (totalDetected > 12) continue; // too rich to be a re-export
      // Must have nothing chain-of-custody or scrub-related
      const hasChain = ["bill_of_sale_available", "prior_assignments_count"].some(
        (n) => canonicalSet.has(n)
      );
      const hasScrub = ["bankruptcy_flag", "deceased_flag", "scra_active_duty_flag"].some(
        (n) => canonicalSet.has(n)
      );
      if (hasChain || hasScrub) continue;
    }

    // Confidence: required match = baseline 0.6; each diagnostic adds 0.1
    // up to 1.0; missing expected fields subtract 0.05 each.
    let confidence = required.length > 0 ? 0.6 : 0.45;
    confidence += Math.min(0.4, diagnosticHits * 0.1);
    confidence -= Math.min(0.2, missingExpected.length * 0.05);
    confidence = Math.max(0, Math.min(1, confidence));

    matches.push({
      fingerprint: fp,
      confidence,
      matchedTokens,
      missingExpected,
    });
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  const topMatch = matches[0] ?? null;

  // Conflicts: if two issuer-family matches both score > 0.6, flag it.
  const conflicts: string[] = [];
  const issuerMatches = matches.filter(
    (m) => m.fingerprint.family === "issuer" && m.confidence > 0.6
  );
  if (issuerMatches.length > 1) {
    conflicts.push(
      `Multiple issuer fingerprints matched: ${issuerMatches
        .map((m) => `${m.fingerprint.label} (${(m.confidence * 100).toFixed(0)}%)`)
        .join(", ")}. Tape may be mixed or fingerprints need refinement.`
    );
  }

  return {
    topMatch,
    allMatches: matches,
    balanceConvention: topMatch?.fingerprint.balanceConvention ?? "unknown",
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// Balance convention detector — empirical check from row data
//
// If BOTH `charge_off_balance` and `account_balance` exist as columns, the
// in-browser analyzer can compare them per-row. A consistent >5% positive
// disagreement (account_balance > charge_off_balance) implies CompuCredit-
// style "balance includes pre-CO interest." A consistent equality implies
// Spiegel-style. Sample-based to keep it fast on large tapes.
// ---------------------------------------------------------------------------

export type BalanceConventionEvidence = {
  convention: BalanceConvention;
  confidence: number; // 0..1
  rowsCompared: number;
  meanDelta: number; // (account_balance - charge_off_balance) / charge_off_balance
  // Plain-English warning suitable for the UI.
  warning: string | null;
};

export function detectBalanceConvention(
  pairs: Array<{ accountBalance: number; chargeOffBalance: number }>,
  fingerprintHint: BalanceConvention | null
): BalanceConventionEvidence {
  // No row evidence — fall back to the fingerprint guess.
  if (pairs.length === 0) {
    return {
      convention: fingerprintHint ?? "unknown",
      confidence: fingerprintHint ? 0.4 : 0,
      rowsCompared: 0,
      meanDelta: 0,
      warning:
        fingerprintHint === "include_pre_co_interest_and_fees"
          ? "Header fingerprint suggests pre-CO interest/fees are included in balance. Calibrate bid accordingly."
          : fingerprintHint === null || fingerprintHint === "unknown"
          ? "Could not determine balance convention from this tape. Ask the seller: does account_balance include post-CO interest, pre-CO interest, or principal only?"
          : null,
    };
  }

  // Sample-based delta. Filter out non-positive balances (sentinels).
  const valid = pairs.filter(
    (p) =>
      Number.isFinite(p.accountBalance) &&
      Number.isFinite(p.chargeOffBalance) &&
      p.chargeOffBalance > 0
  );
  if (valid.length === 0) {
    return {
      convention: fingerprintHint ?? "unknown",
      confidence: 0.3,
      rowsCompared: 0,
      meanDelta: 0,
      warning: "Balance columns exist but no rows could be compared (sentinels or zeros).",
    };
  }

  const deltas = valid.map((p) => (p.accountBalance - p.chargeOffBalance) / p.chargeOffBalance);
  const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

  if (meanDelta < 0.02) {
    // Within 2% → balances effectively equal → Spiegel-style
    return {
      convention: "exclude_post_co_interest_and_fees",
      confidence: 0.9,
      rowsCompared: valid.length,
      meanDelta,
      warning:
        meanDelta < -0.02
          ? `Average account_balance is ${Math.abs(meanDelta * 100).toFixed(1)}% LOWER than charge_off_balance. Unusual — possible post-CO payments or sentinel mix. Investigate.`
          : null,
    };
  }
  if (meanDelta < 0.15) {
    // 2-15% above CO → pre-CO interest/fees included (CompuCredit-style)
    return {
      convention: "include_pre_co_interest_and_fees",
      confidence: 0.85,
      rowsCompared: valid.length,
      meanDelta,
      warning: `account_balance averages ${(meanDelta * 100).toFixed(1)}% above charge_off_balance — balance INCLUDES pre-CO interest/fees (CompuCredit/Encore convention). Your usual cents-on-the-dollar benchmark may be calibrated against principal-only tapes; bid against this convention or you'll overpay.`,
    };
  }
  // >15% above CO → likely post-CO interest accrued, possibly Specialized
  // Legal File subset (judgments).
  return {
    convention: "include_post_co_interest_judgments_only",
    confidence: 0.75,
    rowsCompared: valid.length,
    meanDelta,
    warning: `account_balance averages ${(meanDelta * 100).toFixed(1)}% above charge_off_balance — likely includes post-CO interest, common on judgment tapes or Encore-style 'Specialized Legal File' subsets. Confirm which rows carry which convention before bidding.`,
  };
}
