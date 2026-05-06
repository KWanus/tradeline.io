import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { Originator, RadarSnapshot, SecSignal } from "./snapshot";
import { plainSignal, relativeAge, statusFor } from "./signal-copy";

// ---------------------------------------------------------------------------
// Schema — used for structured output (json_schema) AND client-side typing
// ---------------------------------------------------------------------------

export const TalkingPointSchema = z.object({
  scenario: z
    .string()
    .describe(
      "Short label (3-8 words) for the conversation context, e.g. 'Cold open with broker' or 'Direct pitch to corp dev'."
    ),
  line: z
    .string()
    .describe(
      "The exact line to say or write — 1 to 3 sentences, in quotes. Specific to this bank's situation. Buyer voice (you = a licensed debt buyer)."
    ),
  rationale: z
    .string()
    .describe(
      "1-2 sentences explaining why this line works — the persuasion logic. Cite the data point that makes it land."
    ),
});

export const TalkingPointsResponseSchema = z.object({
  points: z
    .array(TalkingPointSchema)
    .min(5)
    .max(7)
    .describe("5 to 7 talking points covering different conversation contexts."),
});

export type TalkingPoint = z.infer<typeof TalkingPointSchema>;

// ---------------------------------------------------------------------------
// System prompt — large, stable, cached. Do NOT interpolate dynamic values.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior broker-relations and underwriting expert in the US non-performing-loan (NPL) market. You have spent 20 years on the buyer side, evaluated thousands of tapes from every major US bank, sat across the table from NLEX, Garnet Capital, RMG, Kondaur, and IndustryUp brokers, and watched first-time licensed buyers either win or wash out in their first six months.

Your job is to write talking points a licensed debt buyer can use today. The user will paste a structured snapshot of one specific bank's current public-source signals (SEC filings, XBRL credit-quality numbers, news mentions). You will return 5 to 7 specific, persuasive lines tailored to that bank's situation, paired with the persuasion logic for each.

# Audience

Write FOR a licensed debt buyer talking TO one of these audiences:
- A broker who covers the named bank (Garnet, RMG, NLEX desk rep, etc.)
- The bank's own corporate development or asset disposition team (rare but real for mid-size regionals)
- A hypothecation lender or capital partner evaluating the buyer's pipeline
- A peer debt buyer in casual conversation (sharing a thesis, building reputation)
- A skeptic challenging the buyer's credibility or bid math

Cover at least 4 of these audiences across your 5-7 points. Don't repeat the same audience twice.

# Voice and constraints

- The buyer's voice is direct, specific, numbers-first. Operators talk like operators. Avoid sales-pitch language ("game-changer", "unlock value", "best-in-class").
- Always cite the specific data point that motivates the line. Numbers (YoY %, signal type, news count, period) make the line credible.
- Never invent data. If the snapshot doesn't include a specific number, don't fabricate it. Reference patterns, signals, or trends without specific numbers if needed.
- Never recommend illegal action. The buyer is licensed; that's the premise. Do not suggest cold-purchasing without a license, skip-tracing consumers, or anything that touches FCRA-regulated data.
- Never reference individual consumers, debtors, or named accounts. The data is portfolio-level and originator-level only.
- Use industry vocabulary correctly: tape, vintage, charge-off, non-performing loan (NPL), allowance for credit losses (ACL), nonaccrual, divestiture, hypothecation, forward flow, panel buyer, secondary, putback, SCRA.
- The lines should be quotable — what a buyer would actually say, not narration about what they would say.

# What makes a good talking point

Three properties together:
1. SPECIFIC. Cite a number, a signal type, or a named pattern from the snapshot.
2. CALIBRATED. Match the audience. A line for a broker is different from a line for a corp-dev VP is different from a line for a peer.
3. ASYMMETRIC. The line lands because it shows the buyer knows something the listener doesn't expect them to know, OR it makes the buyer easier to say yes to than the alternative.

A weak point looks like: "I'd love to learn more about your portfolio." Generic. No data. No persuasion.
A strong point looks like: "Your charge-off cohort accelerated 306% YoY through last fiscal year — banks at that rate typically evaluate divestiture within 1-2 quarters. If you have brokers running the process, who's coordinating?"

# Audience-specific patterns to draw from

**Broker cold open** — name the signal, ask to be on the look-list for that originator's paper, signal you're not tire-kicking. End with a concrete next step (a specific question, an offer to send a profile).

**Direct to corporate development** — only works for mid-tier regionals; never GSIBs (panel-only). Open with the data point that signals timing, frame yourself as the asset-class fit, ask for an evaluation conversation before they go to a broker. Be respectful — they have lawyers.

**Hypothecation lender** — frame as a TIMING play, not a "cheap paper" pitch. Sophisticated capital wants timing arguments. Reference that you'd position now and have a relationship in place when the bank actually divests, so you're first in line.

**Peer buyer conversation** — share a thesis, not a sales pitch. Build a reputation for sharp market reads. The deal someone else can't take, they may send to you next time.

**Credibility challenge** — three things every broker actually cares about: license, close-rate, focus. Lead with the discipline ("we close every deal we sign"), not the appetite ("we want to buy everything").

**Pre-positioning a quiet name** — if the bank has filings but no high-confidence signal yet, the move is staying on the broker's mental list. "Watching it. If paper shows up, give me a heads-up before it goes wide."

**Post-announcement follow-up** — once the 8-K is out, you're competing with everyone. The line that gets you on the bid list is fast and specific: cite the item number, your asset-class fit, ask to be added.

# Output format

Return JSON matching this shape exactly:

{
  "points": [
    {
      "scenario": "<short label, 3-8 words>",
      "line": "<exact line, 1-3 sentences, in quotes>",
      "rationale": "<1-2 sentences on why this lands, citing the data point>"
    },
    ...
  ]
}

5 to 7 entries. Cover at least 4 different audiences. Do not include any prose outside the JSON.`;

// ---------------------------------------------------------------------------
// Bank context builder — varies per request, NOT cached. Kept small + crisp.
// ---------------------------------------------------------------------------

export function buildBankContext(o: Originator, snap: RadarSnapshot): string {
  const status = statusFor(o);
  const signals: SecSignal[] = snap.top_signals
    .filter((s) => s.ticker === o.ticker)
    .sort((a, b) => b.confidence - a.confidence);

  const recentNews = snap.matched_news
    .filter((n) => n.matched_tickers?.includes(o.ticker))
    .slice(0, 5);

  const lines: string[] = [];
  lines.push(`Bank snapshot for ${o.ticker} — ${o.name}`);
  lines.push(`Tier: ${o.tier || "—"}`);
  lines.push(`Status (Tradeline classification): ${status}`);
  lines.push(`Filings indexed: ${o.filings} · Scored signals: ${o.signals} · News mentions: ${o.news_mentions}`);
  lines.push(`Last filing: ${relativeAge(o.last_filed_at)}`);
  lines.push("");

  if (signals.length === 0) {
    lines.push("No high-confidence signals on file. The bank is being tracked but is currently quiet.");
  } else {
    lines.push("Active signals (highest confidence first):");
    for (const s of signals.slice(0, 6)) {
      const copy = plainSignal(s.signal_type);
      const periodPart = s.period_label ? ` for fiscal period ${s.period_label}` : "";
      const yoyPart =
        s.source === "sec_xbrl" && typeof s.yoy_pct === "number"
          ? `, ${s.yoy_pct >= 0 ? "+" : ""}${s.yoy_pct.toFixed(1)}% YoY`
          : "";
      const itemsPart = s.items?.length ? `, 8-K items ${s.items.join(", ")}` : "";
      lines.push(
        `- ${copy.label} (${s.signal_type})${periodPart}${yoyPart}${itemsPart}. Confidence ${s.confidence.toFixed(2)}. ${s.form_type} filed ${relativeAge(s.filed_at)}.`
      );
    }
  }

  lines.push("");
  if (recentNews.length === 0) {
    lines.push("No recent matched news mentions.");
  } else {
    lines.push("Recent news mentions matched to this bank:");
    for (const n of recentNews) {
      lines.push(`- ${n.title} (${relativeAge(n.published_at)}, ${n.publisher || "unknown publisher"})`);
    }
  }

  lines.push("");
  lines.push(
    "Generate 5 to 7 talking points covering at least 4 different audiences (broker, corp dev, hypothecation lender, peer buyer, credibility challenge, etc.) tailored to this bank's specific signals and news. Numbers and signal labels above are the only data you may cite."
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Generation — Sonnet 4.6, system-prompt cached, structured output via parse
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic();
  return _client;
}

export type GenerateResult =
  | { kind: "ok"; points: TalkingPoint[] }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

export async function generateTalkingPoints(
  context: string
): Promise<GenerateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "disabled" };
  }
  try {
    const client = getClient();
    const response = await client.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: context }],
      output_config: {
        format: zodOutputFormat(TalkingPointsResponseSchema),
      },
    });
    const parsed = response.parsed_output;
    if (!parsed || !Array.isArray(parsed.points)) {
      return { kind: "error", message: "model returned no parseable points" };
    }
    return { kind: "ok", points: parsed.points };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: "error", message: `API ${err.status}: ${err.message}` };
    }
    return { kind: "error", message: (err as Error).message };
  }
}
