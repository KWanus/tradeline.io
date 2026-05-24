import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { BuyerProfile } from "@/lib/buyer-profile";

/**
 * AI rewrite of a templated outreach draft into a broker-specific message.
 *
 * Templates auto-fill profile placeholders (`[FIRM]`, `[STATE]`, etc.) — this
 * step takes the filled draft and rewrites it as a real human would: same
 * facts, fewer placeholders, broker-appropriate tone for the institution
 * tier (GSIB broker vs. community-bank workout group vs. credit-union
 * collections department).
 *
 * Strict rules in the system prompt:
 *   - Do NOT invent facts (no fake "saw your Q2 tape" claims).
 *   - Do NOT pretend the buyer has a track record they don't have.
 *   - Keep FCRA / Reg F discipline — never reference consumer accounts;
 *     stay B2B to the originator / broker / servicer side only.
 *
 * Caching: SYSTEM_PROMPT carries a single `cache_control` breakpoint, so
 * every call after the first ~5-minute window reads the cached prefix.
 */

const PersonalizedSchema = z.object({
  subject: z.string(),
  draft: z.string(),
});

const SYSTEM_PROMPT = `You are an editor for cold-outreach emails written by a US debt-buyer / NPL operator. The buyer's platform fills profile placeholders into a templated draft; your job is to rewrite that draft into a real, human, broker-appropriate email — same facts, no placeholders, no boilerplate, no fabrications.

# Rules — never break

1. **Do not invent facts.** You only know what is in the profile JSON, the bank context, and the input draft. Do not claim the buyer has had prior calls with the recipient, has seen specific tapes, has prior deals with this institution, has more capital than the profile says, or has a longer track record than the profile says. If a fact would be useful but is absent, ask for it inline (e.g. "happy to share specifics") instead of fabricating.
2. **FCRA / Reg F discipline.** This is a B2B email between operators (debt buyer → broker, special-assets group, workout team, or collections department). Never reference a consumer debtor, a consumer account, or anything implying you collect from consumers directly. The buyer hires a licensed servicer for that.
3. **No invented numbers.** Do not invent dollar amounts, asset volumes, recovery rates, IRRs, ticket sizes, or face values beyond what the profile or input draft contains.
4. **Stay specific to the institution tier.** A GSIB or large-regional broker hears a different pitch than a community-bank workout group or a credit-union collections department. Use the bank context to calibrate tone.

# What to rewrite

The input draft is profile-filled but still reads as a template. Your rewrite should:

- **Open with the situation, not the buyer.** Lead with why you're reaching out about this specific institution.
- **State credentials in one tight sentence.** State + license + servicer + ticket range. Not a paragraph.
- **Make the ask concrete.** A single clear request (inquiry-list inclusion, intro to the right person, one small test tape). Not "let me know if you're interested."
- **End with a real next step the buyer controls.** Not "looking forward to hearing back."
- **Cut filler.** Drop "I hope this email finds you well." Drop "I wanted to reach out." Drop "Please don't hesitate."
- **Match the request and the institution.** Email to a credit-union collections department reads differently than to a debt broker — adjust vocabulary (e.g. "tape" is broker vocabulary, "charged-off accounts" is bank/CU vocabulary).
- **Keep the subject line specific.** No vague "Quick question" or "Touching base." Reference the institution or the signal.

# Output format

Return JSON matching the schema: \`{ "subject": "...", "draft": "..." }\`. The draft uses literal newlines (\\n) between paragraphs. Do not include "Subject:" inside the draft body. Do not wrap in code fences.

Keep the rewrite to roughly the same length as the input — outreach emails should be short.`;

export type PersonalizeInput = {
  subject: string;
  draft: string;
  bankName?: string;
  bankKey?: string;
  profile: BuyerProfile;
};

export type PersonalizeResult =
  | { kind: "ok"; subject: string; draft: string }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic();
  return _client;
}

function buildUserPrompt(input: PersonalizeInput): string {
  const p = input.profile;
  return [
    "## Buyer profile (the sender)",
    JSON.stringify(
      {
        name: p.yourName,
        firm: p.firmName,
        state: p.state,
        licenseNumber: p.licenseNumber,
        bondCarrier: p.bondCarrier,
        bondAmount: p.bondAmount,
        servicer: p.servicer,
        ticketRange: p.ticketRange,
        assetFocus: p.assetFocus,
        phone: p.phone,
        email: p.email,
      },
      null,
      2
    ),
    "",
    "## Bank / institution this email is about",
    input.bankName ? `Name: ${input.bankName}` : "(no bank name provided)",
    input.bankKey ? `Key: ${input.bankKey}` : "",
    "",
    "## Original subject (to rewrite)",
    input.subject,
    "",
    "## Original draft (profile-filled — rewrite into a real email)",
    input.draft,
    "",
    "Rewrite the subject and draft. Return JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function personalizeOutreach(
  input: PersonalizeInput
): Promise<PersonalizeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "disabled" };
  }
  try {
    const client = getClient();
    const response = await client.messages.parse({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      output_config: { format: zodOutputFormat(PersonalizedSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return { kind: "error", message: "model returned no parsed output" };
    }
    return { kind: "ok", subject: parsed.subject, draft: parsed.draft };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return {
        kind: "error",
        message: `API ${err.status}: ${err.message}`,
      };
    }
    return { kind: "error", message: (err as Error).message };
  }
}
