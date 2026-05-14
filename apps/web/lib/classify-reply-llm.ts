import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// Broker-reply classifier — turns a pasted email reply into a structured
// next-step: classification, one-line summary, ready-to-paste response.

const SYSTEM_PROMPT = `You classify a broker's reply to a debt-buyer's cold-outreach email and produce the buyer's next response.

# Input you'll receive

- The broker's reply text (could be 1 line or a paragraph, sometimes with their signature)
- The user's buyer profile (firm name, license, bond, servicer, ticket size, asset focus)
- Context about the bank the user pitched (ticker, name, signal that prompted the outreach)

# Output — STRICT JSON, nothing else, no prose, no markdown fence

{
  "classification": "warm" | "passing" | "panel-only" | "wants-info" | "has-tape" | "tape-detail-request" | "needs-license" | "unclear",
  "summary": "<one-sentence plain-English summary of what the broker said>",
  "urgency": "now" | "today" | "this-week" | "no-action",
  "suggested_action": "<one sentence on what the user should do>",
  "reply_subject": "<email subject line, no quotes>",
  "reply_body": "<full email body, ready to send, addressed to the broker (use their first name when discoverable, otherwise 'Hi there'). Personal sign-off uses the user's profile name. No markdown, plain text, 5-10 short lines.>"
}

# Classification taxonomy

- "warm" — broker is engaged, asking follow-up questions, signaling interest. e.g. "Tell me more about your firm." "What's your typical ticket?"
- "passing" — polite no-thanks. "Don't have anything right now." "Not a fit." "Maybe later." Stay-in-touch reply.
- "panel-only" — they only deal with established panel buyers. Ask path to panel.
- "wants-info" — they explicitly ask for buyer profile, license PDF, bond letter. Send the materials.
- "has-tape" — they're sending or about to send a tape. Move to /app/tools/tape next.
- "tape-detail-request" — they want specific details about your firm before sending tape. Provide and stay close.
- "needs-license" — gatekeeper question on your state license. Confirm + attach.
- "unclear" — you can't tell from the reply. Ask a clarifying question.

# Reply tone

- Match the broker's register. If they were terse, be terse. If they wrote a paragraph, write a paragraph.
- Never claim deals you haven't closed. Use phrasing the user's profile supports.
- Reference the specific bank/signal in the reply so they remember the thread.
- End with a concrete next step the broker can act on (forward a tape, hop on a 15-min call, etc.)
- If urgency is "now" or "today", the reply should ask for a same-week step.

# Hard rule

Output ONE JSON object. Nothing before or after. No \`\`\`json fence.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic();
  return _client;
}

export type ReplyClassification = {
  classification:
    | "warm"
    | "passing"
    | "panel-only"
    | "wants-info"
    | "has-tape"
    | "tape-detail-request"
    | "needs-license"
    | "unclear";
  summary: string;
  urgency: "now" | "today" | "this-week" | "no-action";
  suggested_action: string;
  reply_subject: string;
  reply_body: string;
};

export type ClassifyResult =
  | { kind: "ok"; data: ReplyClassification }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

export async function classifyBrokerReply(args: {
  brokerReply: string;
  userContext: string;
  bankContext: string;
}): Promise<ClassifyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "disabled" };
  }
  if (!args.brokerReply.trim()) {
    return { kind: "error", message: "broker reply is empty" };
  }
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            `# Bank context\n${args.bankContext.trim()}`,
            `# User profile\n${args.userContext.trim()}`,
            `# Broker reply\n${args.brokerReply.trim()}`,
          ].join("\n\n"),
        },
      ],
    });

    let combined = "";
    for (const block of response.content) {
      if (block.type === "text") combined += block.text;
    }
    if (!combined.trim()) {
      return { kind: "error", message: "model returned no text" };
    }

    // Try to parse JSON (model is instructed to output ONLY JSON, but be defensive).
    const jsonText = extractJSON(combined);
    if (!jsonText) {
      return { kind: "error", message: "could not parse JSON from response" };
    }
    const parsed = JSON.parse(jsonText) as ReplyClassification;
    if (!parsed.classification || !parsed.reply_body) {
      return { kind: "error", message: "missing required fields in classification" };
    }
    return { kind: "ok", data: parsed };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: "error", message: `API ${err.status}: ${err.message}` };
    }
    return { kind: "error", message: (err as Error).message };
  }
}

/** Find the first balanced JSON object in a string. Handles models that
 *  accidentally wrap the JSON in markdown fences or a sentence of preface. */
function extractJSON(text: string): string | null {
  // Strip ```json ... ``` fence if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
