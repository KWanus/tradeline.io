import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { SEGMENT_LABELS } from "./store";
import type { DiscoveredLead } from "./discover-llm";

/**
 * Draft the sales email for each discovered prospect — one Claude call for
 * the whole batch (cheaper + more consistent than per-lead). The model writes
 * subject + body ONLY; the CAN-SPAM footer (physical address + a real signed
 * unsubscribe link) is appended in code by the caller so it is always present
 * and always correct.
 */

const SYSTEM_PROMPT = `You write short, honest B2B cold sales emails for Tradeline — a SaaS that gives licensed debt buyers institutional intelligence: it surfaces non-performing-loan deal flow from public data (SEC 8-Ks, FDIC/NCUA call reports), scores portfolios, finds the right special-assets contact at a bank, drafts compliant outreach, and tracks FCRA/Reg F compliance. Plans run ~$99–$499/mo with a free trial.

You are given a JSON array of prospects (firm, segment, contactName, rationale) and a TOUR_URL. For EACH prospect, write a tailored cold email selling Tradeline.

# Rules
1. **Honest.** Don't claim the recipient uses a competitor, don't invent metrics, don't pretend you've spoken before. You may reference what's PUBLICLY true about their segment.
2. **Short.** 70–120 words. 3 short paragraphs max. A busy operator reads it in 10 seconds.
3. **Segment-tailored.** A debt broker hears a different angle than a collection agency or a distressed-credit fund. Lead with the one outcome that segment cares about (more/cheaper deal flow, faster sourcing, compliance cover, scored bids).
4. **One clear CTA + the tour.** Invite them to watch the 2-minute visual walkthrough at TOUR_URL and reply if they want a trial. Exactly one ask.
5. **Plain text.** No markdown, no images, no "Dear Sir/Madam", no "I hope this finds you well". If contactName is present, open with their first name; otherwise open with the firm or a neutral greeting.
6. **No footer.** Do NOT add an unsubscribe line, signature block, or address — those are appended automatically. End the body after the CTA.
7. Subject: specific, lowercase-ish, no clickbait, no "Re:" trick. Reference deal flow / their segment, not "quick question".

# Output (strict)
Return ONLY a JSON array (no prose, no code fences), same length and ORDER as the input, each: { "subject": "...", "body": "..." }. Body uses literal \\n between paragraphs.`;

export type ComposedDraft = { subject: string; body: string };

export type ComposeArgs = {
  leads: DiscoveredLead[];
  tourUrl: string;
  /** Sender identity for tailoring tone (not inserted as a footer). */
  senderName: string;
  senderFirm: string;
};

export type ComposeResult =
  | { kind: "ok"; drafts: ComposedDraft[] }
  | { kind: "error"; message: string };

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic();
  return _client;
}

function extractDrafts(text: string, n: number): ComposedDraft[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, n).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      subject: typeof r.subject === "string" ? r.subject.trim() : "",
      body: typeof r.body === "string" ? r.body.trim() : "",
    };
  });
}

export async function composeDrafts(args: ComposeArgs): Promise<ComposeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "error", message: "ANTHROPIC_API_KEY not set" };
  }
  if (args.leads.length === 0) return { kind: "ok", drafts: [] };

  const promptLeads = args.leads.map((l, i) => ({
    i,
    firm: l.firm,
    segment: SEGMENT_LABELS[l.segment],
    contactName: l.contactName,
    rationale: l.rationale,
  }));

  const userMsg = `TOUR_URL: ${args.tourUrl}
Sender: ${args.senderName || "the Tradeline team"}${args.senderFirm ? ` (${args.senderFirm})` : ""}

Prospects (write one email each, same order):
${JSON.stringify(promptLeads, null, 2)}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMsg }],
    });

    let combined = "";
    for (const block of response.content) {
      if (block.type === "text") combined += block.text;
    }
    const drafts = extractDrafts(combined, args.leads.length);
    if (drafts.length !== args.leads.length) {
      return {
        kind: "error",
        message: `composer returned ${drafts.length} drafts for ${args.leads.length} leads`,
      };
    }
    return { kind: "ok", drafts };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: "error", message: `API ${err.status}: ${err.message}` };
    }
    return { kind: "error", message: (err as Error).message };
  }
}

/**
 * Append the CAN-SPAM footer to a drafted body. Always called in code so the
 * physical address + signed unsubscribe link are guaranteed present.
 *   - GROWTH_POSTAL_ADDRESS env supplies the required physical mailing address.
 *   - unsubscribeUrl is a per-recipient signed link (lib/unsubscribe).
 */
export function withFooter(body: string, unsubscribeUrl: string | null): string {
  const address =
    process.env.GROWTH_POSTAL_ADDRESS?.trim() ||
    "Tradeline — mailing address on file";
  const optOut = unsubscribeUrl
    ? `Not relevant? Unsubscribe here and we won't email again: ${unsubscribeUrl}`
    : `Not relevant? Reply "STOP" and we won't email again.`;
  return `${body.trim()}\n\n—\n${optOut}\n${address}`;
}
