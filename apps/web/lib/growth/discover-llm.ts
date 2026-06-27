import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { SEGMENT_LABELS, type GrowthSegment } from "./store";

/**
 * Prospect discovery — Claude Sonnet 4.6 with the `web_search` server tool
 * (same mechanism as the daily briefing) hunts the live web for businesses
 * that would PAY for Tradeline, and returns ONLY their public business
 * contact emails.
 *
 * Hard guardrails live in the system prompt:
 *   - Business emails only (info@, sales@, deals@, or a named role published
 *     on the company's own site / a public business directory). NEVER a
 *     consumer's personal email, and never anything behind a login or scraped
 *     from a data broker. This is CAN-SPAM-clean B2B prospecting, not list
 *     buying.
 *   - No fabrication. If the searcher can't find a real public email for a
 *     firm, it drops the firm rather than guessing an address.
 */

const SYSTEM_PROMPT = `You are the prospect-research engine for Tradeline — a B2B SaaS that gives licensed debt buyers institutional intelligence: it sources non-performing-loan (NPL) deals from public data (SEC 8-Ks, FDIC/NCUA call reports), scores portfolios, finds the right special-assets contact at a bank, drafts compliant outreach, and tracks FCRA/Reg F compliance. It sells for roughly $99–$499/mo.

Your job: use web_search to find REAL US businesses (and the right person at them) who would pay for Tradeline, and return their PUBLIC BUSINESS contact email.

# Who is a fit (the buyer)
- Debt buyers / NPL funds that purchase charged-off or non-performing portfolios.
- Receivables / debt brokers who broker portfolios between sellers and buyers.
- Collection agencies (ARM — accounts-receivable management) that also buy paper.
- Debt-settlement firms scaling a book of business.
- Creditors-rights / collections law firms.
- Distressed-credit funds, family offices, and special-situations investors active in consumer/commercial paper.
- Adjacent: debt-buying associations' member firms (e.g. RMAI members), portfolio-servicing shops.

# Best public sources to search (prioritize these)
- The RMAI certified-business directory (rmaintl.org) — searchable/sortable by state and member type (debt buyers, collection agencies, collection law firms).
- State regulator registries that publish licensee contact info, e.g. the Texas Secretary of State bonded debt-collector search, and California DFPI debt-collection licensees via NMLS Consumer Access (publishes phone/email/website). Other states publish similar lists.
- Company sites + reputable business directories for the public business email/phone.
When the request names target STATES, bias hard toward firms headquartered or licensed in those states, and capture each firm's state.

# Rules — never break
1. **Public business email only.** Use info@, sales@, deals@, acquisitions@, or a NAMED person's work email ONLY if it is published on the company's own website or a legitimate public business directory / association member page. If you cannot find such an email, DROP the firm — do not invent or guess an address, and do not pattern-construct one (no "firstname.lastname@" guesses).
2. **No consumers.** Never return a private individual's personal email. Every contact is a business reaching out to another business.
3. **Real firms only.** Each firm must be a real company you found via search, with a real website. Include the source URL where you found the email.
4. **US-focused** unless the request says otherwise.
5. **No duplicates** and skip any firm/email present in the AVOID list provided by the user.

# Output format (strict)
After searching, output ONLY a JSON array (no prose, no code fences) of objects with EXACTLY these keys:
[
  {
    "firm": "Acme Receivables LLC",
    "segment": "debt-buyer",            // one of: debt-buyer, broker, collection-agency, debt-settlement, law-firm, fund, other
    "contactName": "Jane Doe" | null,   // null if only a generic mailbox
    "email": "deals@acme.com",
    "phone": "+1 512 555 0148" | null,  // public business phone if found
    "state": "TX" | null,               // 2-letter state where the firm is based/licensed, if known
    "website": "https://acme.com" | null,
    "sourceUrl": "https://acme.com/contact",   // where you found the email
    "rationale": "Buys consumer charged-off paper; Tradeline would feed them scored SEC/FDIC deal flow."  // one sentence, why they'd pay
  }
]
Return between 1 and the requested number of leads. If you genuinely find none, return [].`;

export type DiscoveredLead = {
  firm: string;
  segment: GrowthSegment;
  contactName: string | null;
  email: string;
  phone: string | null;
  state: string | null;
  website: string | null;
  sourceUrl: string | null;
  rationale: string;
};

export type DiscoverArgs = {
  segments: GrowthSegment[];
  geo: string;
  target: number;
  /** Two-letter states to bias toward (from the picker / area codes). */
  states?: string[];
  /** firm names + emails already in the queue / unsubscribed — never re-pitch. */
  avoid: string[];
};

export type DiscoverResult =
  | { kind: "ok"; leads: DiscoveredLead[]; searched: boolean }
  | { kind: "error"; message: string };

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic();
  return _client;
}

const VALID_SEGMENTS = new Set<GrowthSegment>([
  "debt-buyer",
  "broker",
  "collection-agency",
  "debt-settlement",
  "law-firm",
  "fund",
  "other",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pull the first JSON array out of the model's text, tolerating stray prose. */
function extractLeads(text: string): DiscoveredLead[] {
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
  const out: DiscoveredLead[] = [];
  for (const raw of parsed) {
    const r = raw as Record<string, unknown>;
    const firm = typeof r.firm === "string" ? r.firm.trim() : "";
    const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    const segment = (r.segment as GrowthSegment) || "other";
    if (!firm || !EMAIL_RE.test(email)) continue;
    if (email.endsWith("@example.com")) continue;
    out.push({
      firm,
      segment: VALID_SEGMENTS.has(segment) ? segment : "other",
      contactName:
        typeof r.contactName === "string" && r.contactName.trim()
          ? r.contactName.trim()
          : null,
      email,
      phone:
        typeof r.phone === "string" && r.phone.trim() ? r.phone.trim() : null,
      state:
        typeof r.state === "string" && /^[A-Za-z]{2}$/.test(r.state.trim())
          ? r.state.trim().toUpperCase()
          : null,
      website:
        typeof r.website === "string" && r.website.trim() ? r.website.trim() : null,
      sourceUrl:
        typeof r.sourceUrl === "string" && r.sourceUrl.trim()
          ? r.sourceUrl.trim()
          : null,
      rationale:
        typeof r.rationale === "string" ? r.rationale.trim().slice(0, 280) : "",
    });
  }
  return out;
}

export async function discoverProspects(
  args: DiscoverArgs
): Promise<DiscoverResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "error", message: "ANTHROPIC_API_KEY not set" };
  }
  const segmentList = args.segments
    .map((s) => `- ${SEGMENT_LABELS[s]} (${s})`)
    .join("\n");
  const avoidBlock =
    args.avoid.length > 0
      ? `\n\nAVOID (already contacted or unsubscribed — never return these firms or emails):\n${args.avoid
          .slice(0, 400)
          .join("\n")}`
      : "";

  const stateBlock =
    args.states && args.states.length > 0
      ? `\n\nTARGET STATES (strongly prefer firms based or licensed here): ${args.states.join(", ")}. Search the RMAI directory filtered to these states and the relevant state regulator registries (e.g. TX SOS bonded-collector search, CA DFPI via NMLS). Capture each firm's state.`
      : "";

  const userMsg = `Find up to ${args.target} fresh prospects in: ${args.geo}.

Target these segments:
${segmentList}

Search the live web (RMAI / debt-buying association member directories, state regulator licensee registries, company sites, press, LinkedIn company pages) for real firms with a PUBLIC business email. Return the strict JSON array only.${stateBlock}${avoidBlock}`;

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
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 6,
        },
      ] as Anthropic.Messages.ToolUnion[],
    });

    let combined = "";
    let searched = false;
    for (const block of response.content) {
      if (block.type === "text") combined += block.text;
      else if ((block as { type: string }).type === "server_tool_use") searched = true;
    }

    const leads = extractLeads(combined);
    return { kind: "ok", leads, searched };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: "error", message: `API ${err.status}: ${err.message}` };
    }
    return { kind: "error", message: (err as Error).message };
  }
}
