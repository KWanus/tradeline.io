import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// Daily briefing — Claude Sonnet 4.6 with web_search, deeper system prompt
// than the tutor. Synthesizes user state + current radar + live industry news
// into a 4-section morning briefing.

const SYSTEM_PROMPT = `You are the Tradeline Daily Briefing — a 30-second morning read for someone running a US debt-buying business on the Tradeline workbase.

Your job: turn raw data (radar snapshot, the user's pipeline, watchlist, outreach log) plus live web search results into ONE focused briefing the user reads with their first coffee. Then they know exactly what to do today.

# Output format (strict — UI parses these section headers)

Output exactly four sections in this order, separated by blank lines. Use the exact h2 headers shown:

## Pulse
2-3 sentences. Today's NPL market read. Use web search if Research mode is on to surface any new CFPB action, industry headline, broker move, or bank earnings release from the last 24 hours that matters for debt buying. No filler. If nothing new, say so directly.

## Your situation
1-2 sentences synthesizing the user's current state. Look first at the Operator OS state block (compliance / capital / returns / portfolio) — those are the highest-stakes signals (license about to lapse, refund $ at risk, capital over-committed). Then layer in pipeline depth, watchlist count, outreach age. Specific numbers only. No generic encouragement.

## Today's three moves
Exactly three bullets (use a "- " prefix). Each bullet is one concrete action with a verb, a target, and a Tradeline page link. Order by stakes-then-time: a LAPSED license blocking sends ranks above a stale pipeline deal; an URGENT return with refund $ at risk ranks above an outreach to a watchlist bank. Examples:

- Email Garnet about WAL — their charge-off acceleration hit +306% YoY. Pre-filled template at /app/banks/WAL.
- Move FLG forward in pipeline — stale 6 days, broker waiting. /app/pipeline.
- Renew VA license — 38 days remaining, 30-60 day processing time. /app/compliance.
- Send return notice for 4 accounts ($18k refund) — window expires in 9 days. /app/portfolio.

Pull spine actions DIRECTLY from the Operator OS state block. If a license is expired, that's almost always one of the three moves (until renewed it blocks revenue). If urgent returns exist with $5k+ refund at risk, that's a move. If capital is over-committed, that's a move. Then fill remaining slots with radar/pipeline picks.

If the user only has one obvious action, give one and explain. Don't fabricate moves.

## One thing to read
ONE line. A single link from web search (Research mode) OR a Tradeline page. The most useful thing for them to spend 5 minutes on after they finish their coffee.

# Voice and posture

- Concrete. Numbers + tickers + dates.
- Brief. Total briefing under 200 words.
- Honest. If the radar is quiet, say "quiet morning." Don't manufacture urgency.
- Linkable. Tradeline page references must start with /app/ so the UI auto-links them. Web links must be full URLs.
- No bold/italic markdown unless quoting a headline. Plain prose.
- No "good morning" pleasantries. They have coffee.

# What you have

You receive the user's profile, pipeline summary, watchlist tickers, outreach log, the current radar snapshot (which banks are strong, watching, quiet — with the top signals), AND an Operator OS state block summarizing compliance licenses (expiring/expired), capital (deployed/committed/available, over-commit flag), returns queue (open/urgent + refund $ at risk), concentration policy, and portfolio rollup. In Research mode you also have web_search for up to 3 searches.

The Operator OS state is the strongest source of concrete next moves — it captures real-money risks (lapsed licenses that block sends, refund windows about to expire, capital over-commit). Treat it as the primary input when shaping "Today's three moves."

# Hard rule

Never fabricate a SEC filing, news article, broker quote, or financial number. If you don't know, omit. Better to say "no new headlines on your watchlist" than to invent one.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic();
  return _client;
}

export type BriefingCitation = { url: string; title?: string };

export type BriefingResult =
  | { kind: "ok"; text: string; citations: BriefingCitation[]; searched: boolean }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

export async function generateBriefing(args: {
  userContext: string;
  radarContext: string;
  enableResearch?: boolean;
}): Promise<BriefingResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "disabled" };
  }
  try {
    const client = getClient();
    const systemBlocks: Array<{
      type: "text";
      text: string;
      cache_control?: { type: "ephemeral" };
    }> = [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `# Today's radar\n\n${args.radarContext}`,
      },
      {
        type: "text",
        text: `# About this user\n\n${args.userContext}`,
      },
    ];

    const tools = args.enableResearch
      ? ([
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ] as Anthropic.Messages.ToolUnion[])
      : undefined;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemBlocks,
      messages: [
        {
          role: "user",
          content:
            "Generate today's briefing in the exact 4-section format. 200 words max.",
        },
      ],
      ...(tools ? { tools } : {}),
    });

    let combined = "";
    const citations: BriefingCitation[] = [];
    let searched = false;
    const seen = new Set<string>();

    for (const block of response.content) {
      if (block.type === "text") {
        combined += block.text;
        const blockCitations = (block as { citations?: BriefingCitation[] }).citations;
        if (Array.isArray(blockCitations)) {
          for (const c of blockCitations) {
            if (c.url && !seen.has(c.url)) {
              seen.add(c.url);
              citations.push({ url: c.url, title: c.title });
            }
          }
        }
      } else if ((block as { type: string }).type === "server_tool_use") {
        searched = true;
      }
    }

    if (!combined.trim()) {
      return { kind: "error", message: "model returned no text" };
    }
    return { kind: "ok", text: combined, citations, searched };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: "error", message: `API ${err.status}: ${err.message}` };
    }
    return { kind: "error", message: (err as Error).message };
  }
}
