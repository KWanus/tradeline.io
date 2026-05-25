import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// 1-page underwriting memo generator.
//
// Takes the sanitized output of the in-browser tape decoder (aggregates,
// schema fitness, fingerprint, balance convention, SOL summary, license
// impact, concentration breaches, bid heuristic) and asks Claude to
// synthesize a sign-off-ready memo. NO row-level data, NO PII, NO raw
// header strings (those could leak PII column names) — only aggregate
// summaries derived in the browser.
//
// The memo replaces the 4-8 hours of analyst hand-writing that happens
// today at most buyers, and produces output that fits in an underwriting
// folder or an LP update.

const SYSTEM_PROMPT = `You are the Tradeline Underwriting Memo generator — a senior debt-portfolio underwriter writing a sign-off-ready memo for an operator buying secondary consumer-debt paper.

Your job: turn a structured tape-decoder summary into ONE focused memo that the operator can put in their underwriting folder, send to their LP, or share with a partner.

# Output format (strict — UI parses these section headers)

Output exactly these sections in this order. Use the exact h2 headers shown. Markdown only, no HTML.

# Tape Underwriting Memo

**One-line take:** [single sentence — should this be bid, walked, or supplemented? state the recommendation up front]

## Tape
One line: row count, face value, average balance, top asset class.

## Tape character
1-3 sentences on originator fingerprint + balance convention. State what this implies for pricing — especially the CompuCredit-style "includes pre-CO interest" trap that's a 10-30% mispricing risk if the buyer applies their usual cents-on-the-dollar benchmark to it. If no fingerprint matched, say so plainly.

## Schema & validation
1-2 sentences on Reg F minimum compliance and schema completeness grade. If Reg F failed, name the missing fields and recommend "do not bid until supplemented." If completeness is C or below, note what categories are sparse.

## Time-bar exposure
1-3 sentences on SOL findings. Cite lapsed face value (uncollectable by suit) and cliff face value (within 90 days of SOL lapse — outreach priority). If anchor mix is dominated by anything other than last-payment date, note the SOL-anchor reliability caveat.

## License coverage
1-2 sentences. If license map is configured: cite covered vs. uncovered face value, name top uncovered states. If unconfigured: one line saying "operator has not configured license map; cannot quantify license-driven face discount."

## Concentration
1-2 sentences. If policy configured and breaches exist: list severe breaches first, then moderate. If no policy: skip with "no concentration policy configured." If policy + no breaches: one line saying so.

## Bid recommendation
2-4 sentences. Start with the disciplined bid (cents/$ and dollars). Then explicitly state ADJUSTMENTS: subtract lapsed-SOL face, subtract uncovered-license face. Show the adjusted enforceable face and adjusted bid. End with: "max bid at IRR target = X¢/$; recommended actual bid = Y¢/$."

## Deal-breakers / asks
Bullet list (use "- " prefix). Each bullet is one specific thing to demand from the seller before closing — supplemental fields, balance-convention confirmation, media availability, missing scrubs, etc. 2-5 bullets. If genuinely nothing, write "- None — clean tape, proceed to bid."

# Voice and posture

- Concrete. Numbers + percentages + dollar amounts. No qualitative filler.
- Brief. Total memo under 500 words. Aim for 350-400.
- Decisive. Take a position. "Bid", "walk", "supplement then bid" — pick one.
- Numbers come from input only. NEVER fabricate a percentage, dollar amount, state, or fingerprint that isn't in the input data.
- No "we recommend" or "you should consider" — write as the operator's underwriter, in their voice.
- No bold/italic except the "One-line take:" lead.

# Hard rules

- If a section's input data is missing or null, say so plainly rather than invent.
- Never quote a regulation, court case, or vendor name that isn't explicitly in the input.
- Don't editorialize about the seller. Stick to what the tape shows.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic();
  return _client;
}

// ---------------------------------------------------------------------------
// Sanitized input shape — what the API route accepts after sanitization.
// Built by the client side from TapeAggregates + LicenseImpact +
// ConcentrationReport + bid heuristic. NO raw header strings, NO row data,
// NO PII anywhere.
// ---------------------------------------------------------------------------

export type MemoInput = {
  rowCount: number;
  totalFaceValue: number;
  averageBalance: number;
  topAssetClass: string | null;

  // Schema fitness
  schemaGrade: "A" | "B" | "C" | "D" | "F";
  schemaWeightedPct: number;
  regFPass: boolean;
  regFMissing: string[];
  detectedCanonicalFieldCount: number;
  totalCanonicalFieldCount: number;
  sparseCategories: string[]; // category labels with <40% completeness

  // Originator + balance
  fingerprintLabel: string | null;
  fingerprintConfidence: number;
  fingerprintWarnings: string[];
  balanceConventionLabel: string;
  balanceConventionWarning: string | null;
  balanceConventionRowsCompared: number;
  balanceConventionMeanDeltaPct: number;

  // SOL
  solAccountsAnalyzed: number;
  solLapsedCount: number;
  solLapsedFace: number;
  solCliff90Count: number;
  solCliff90Face: number;
  solHealthyCount: number;
  solHealthyFace: number;
  solAnchorMix: { last_payment_date: number; charge_off_date: number; open_date: number; judgment_date: number; none: number };

  // Distributions
  topStates: Array<{ state: string; pct: number; faceValue: number }>;
  topVintages: Array<{ period: string; pct: number; faceValue: number }>;
  assetClasses: Array<{ name: string; pct: number; faceValue: number }>;

  // License coverage
  licenseConfigured: boolean;
  licenseCoveredFace: number;
  licenseUncoveredFace: number;
  licenseUncoveredPct: number;
  licenseTopUncoveredStates: Array<{ state: string; pct: number; faceValue: number }>;

  // Concentration
  concentrationConfigured: boolean;
  concentrationPolicy: { state: number | null; vintage: number | null; assetClass: number | null } | null;
  concentrationBreaches: Array<{ dimension: string; key: string; pct: number; limit: number; severity: string }>;

  // Bid heuristic
  bidPresetLabel: string;
  bidRecoveryPct: number;
  bidWorkoutYears: number;
  bidServicerFeePct: number;
  bidIrrPct: number;
  bidMaxDollars: number;
  bidMaxCentsPerDollar: number;
  bidDisciplinedDollars: number;
  bidDisciplinedCentsPerDollar: number;
};

export type MemoResult =
  | { kind: "ok"; markdown: string }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

export async function generateUnderwritingMemo(input: MemoInput): Promise<MemoResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { kind: "disabled" };

  try {
    const client = getClient();
    const userContent = formatInputForLlm(input);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache the system prompt — it's static and large; this is read
          // on every memo generation.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { kind: "error", message: "No text content returned" };
    }
    return { kind: "ok", markdown: textBlock.text };
  } catch (err) {
    return { kind: "error", message: (err as Error).message ?? "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Format the sanitized input as a structured prompt the model can synthesize
// from. Each section is labeled so the model knows where each fact came from.
// ---------------------------------------------------------------------------

function formatInputForLlm(i: MemoInput): string {
  const fmt$ = (n: number): string => {
    if (!Number.isFinite(n) || n === 0) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
  };

  const lines: string[] = [];
  lines.push("# Tape decoder output — please synthesize into the standard memo format.");
  lines.push("");
  lines.push("## Basic facts");
  lines.push(`- Account count: ${i.rowCount.toLocaleString()}`);
  lines.push(`- Total face value: ${fmt$(i.totalFaceValue)}`);
  lines.push(`- Average balance: ${fmt$(i.averageBalance)}`);
  if (i.topAssetClass) lines.push(`- Top asset class: ${i.topAssetClass}`);

  lines.push("");
  lines.push("## Schema fitness");
  lines.push(`- Canonical fields detected: ${i.detectedCanonicalFieldCount} of ${i.totalCanonicalFieldCount}`);
  lines.push(`- Weighted schema grade: ${i.schemaGrade} (${i.schemaWeightedPct.toFixed(0)}%)`);
  lines.push(`- Reg F §1006.34 minimum: ${i.regFPass ? "PASS" : "FAIL"}`);
  if (!i.regFPass) lines.push(`- Missing Reg F fields: ${i.regFMissing.join(", ")}`);
  if (i.sparseCategories.length > 0)
    lines.push(`- Sparse categories (<40% complete): ${i.sparseCategories.join(", ")}`);

  lines.push("");
  lines.push("## Originator fingerprint");
  if (i.fingerprintLabel) {
    lines.push(`- Match: ${i.fingerprintLabel} (${Math.round(i.fingerprintConfidence * 100)}% confidence)`);
    if (i.fingerprintWarnings.length > 0)
      lines.push(`- Fingerprint warnings: ${i.fingerprintWarnings.join(" | ")}`);
  } else {
    lines.push(`- No known fingerprint matched.`);
  }

  lines.push("");
  lines.push("## Balance convention");
  lines.push(`- Inferred: ${i.balanceConventionLabel}`);
  if (i.balanceConventionRowsCompared > 0) {
    lines.push(
      `- Empirical: ${i.balanceConventionRowsCompared.toLocaleString()} rows sampled, mean delta ${i.balanceConventionMeanDeltaPct.toFixed(1)}% (account_balance vs. charge_off_balance)`
    );
  }
  if (i.balanceConventionWarning) lines.push(`- Warning: ${i.balanceConventionWarning}`);

  lines.push("");
  lines.push("## SOL findings");
  if (i.solAccountsAnalyzed > 0) {
    lines.push(`- Accounts analyzed for SOL: ${i.solAccountsAnalyzed.toLocaleString()}`);
    lines.push(`- Already lapsed: ${i.solLapsedCount.toLocaleString()} accounts, ${fmt$(i.solLapsedFace)} face`);
    lines.push(`- Within 90 days of lapse (cliff): ${i.solCliff90Count.toLocaleString()} accounts, ${fmt$(i.solCliff90Face)} face`);
    lines.push(`- Healthy: ${i.solHealthyCount.toLocaleString()} accounts, ${fmt$(i.solHealthyFace)} face`);
    lines.push(
      `- Anchor mix: ${pctOf(i.solAnchorMix.last_payment_date, i.solAccountsAnalyzed).toFixed(0)}% last-payment, ${pctOf(i.solAnchorMix.charge_off_date, i.solAccountsAnalyzed).toFixed(0)}% charge-off, ${pctOf(i.solAnchorMix.open_date, i.solAccountsAnalyzed).toFixed(0)}% open-date, ${pctOf(i.solAnchorMix.judgment_date, i.solAccountsAnalyzed).toFixed(0)}% judgment, ${pctOf(i.solAnchorMix.none, i.solAccountsAnalyzed).toFixed(0)}% no-anchor`
    );
  } else {
    lines.push(`- SOL could not be computed (missing state and/or date anchors).`);
  }

  lines.push("");
  lines.push("## Distributions");
  if (i.topStates.length > 0)
    lines.push(
      `- Top states: ${i.topStates.map((s) => `${s.state} ${s.pct.toFixed(0)}% (${fmt$(s.faceValue)})`).join(", ")}`
    );
  if (i.topVintages.length > 0)
    lines.push(
      `- Vintages: ${i.topVintages.map((v) => `${v.period} ${v.pct.toFixed(0)}%`).join(", ")}`
    );
  if (i.assetClasses.length > 0)
    lines.push(
      `- Asset classes: ${i.assetClasses.map((a) => `${a.name} ${a.pct.toFixed(0)}%`).join(", ")}`
    );

  lines.push("");
  lines.push("## License coverage");
  if (i.licenseConfigured) {
    lines.push(`- Covered face: ${fmt$(i.licenseCoveredFace)} (${(100 - i.licenseUncoveredPct).toFixed(1)}%)`);
    lines.push(`- Uncovered face: ${fmt$(i.licenseUncoveredFace)} (${i.licenseUncoveredPct.toFixed(1)}%)`);
    if (i.licenseTopUncoveredStates.length > 0) {
      lines.push(
        `- Top uncovered states: ${i.licenseTopUncoveredStates.map((s) => `${s.state} ${s.pct.toFixed(1)}% (${fmt$(s.faceValue)})`).join(", ")}`
      );
    }
  } else {
    lines.push(`- License map NOT configured by operator.`);
  }

  lines.push("");
  lines.push("## Concentration");
  if (i.concentrationConfigured && i.concentrationPolicy) {
    lines.push(
      `- Policy limits: state ≤${i.concentrationPolicy.state ?? "—"}%, vintage ≤${i.concentrationPolicy.vintage ?? "—"}%, asset class ≤${i.concentrationPolicy.assetClass ?? "—"}%`
    );
    if (i.concentrationBreaches.length > 0) {
      lines.push(`- Breaches:`);
      for (const b of i.concentrationBreaches) {
        lines.push(`  - ${b.severity.toUpperCase()} ${b.dimension}: ${b.key} = ${b.pct.toFixed(1)}% (limit ${b.limit}%)`);
      }
    } else {
      lines.push(`- No breaches.`);
    }
  } else {
    lines.push(`- Concentration policy NOT configured.`);
  }

  lines.push("");
  lines.push("## Bid heuristic");
  lines.push(
    `- Preset: ${i.bidPresetLabel} (${i.bidRecoveryPct.toFixed(1)}% recovery over ${i.bidWorkoutYears}y, ${i.bidServicerFeePct.toFixed(0)}% servicer fee, ${i.bidIrrPct.toFixed(0)}% IRR target)`
  );
  lines.push(`- Max bid at IRR: ${fmt$(i.bidMaxDollars)} (${i.bidMaxCentsPerDollar.toFixed(2)}¢/$)`);
  lines.push(`- Disciplined bid (15% margin): ${fmt$(i.bidDisciplinedDollars)} (${i.bidDisciplinedCentsPerDollar.toFixed(2)}¢/$)`);

  return lines.join("\n");
}

function pctOf(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}
