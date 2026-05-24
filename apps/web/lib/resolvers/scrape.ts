import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { ResolveInput, ResolveResult, ResolvedContact } from "./types";

const USER_AGENT =
  "Tradeline-ContactResolver/0.1 (+https://tradeline.io · b2b-only · respects-robots)";

/**
 * Path templates worth trying on a bank's own domain. Ordered by typical
 * yield for community banks and credit unions. We cap at this set rather
 * than crawling because every fetch adds latency and bandwidth.
 */
const CANDIDATE_PATHS = [
  "/special-assets",
  "/loan-workout",
  "/recovery",
  "/collections",
  "/loans",
  "/business/loans",
  "/contact",
  "/contact-us",
  "/about/leadership",
  "/about/team",
  "/leadership",
  "/about",
  "/about-us",
];

/**
 * Guess the bank's domain from its display name. Best-effort heuristic only —
 * if the caller passes an explicit `domain`, we use that. Otherwise we try a
 * tiny set of common slug patterns. Misses fall through to "no contact found"
 * which the UI handles by surfacing a manual recipient field.
 */
function guessDomains(companyName: string): string[] {
  const clean = companyName
    .toLowerCase()
    .replace(/\bnational\s+association\b/g, "")
    .replace(/\b(bank|bancorp|bancshares|holdings|holding|company|co|incorporated|inc|na|nat'l|the|of|and|&)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  const noSpaces = clean.replace(/\s/g, "");
  const candidates = new Set<string>();
  candidates.add(`${noSpaces}.com`);
  candidates.add(`${noSpaces}bank.com`);
  candidates.add(`${noSpaces}.bank`);
  // First word only — often the brand. "Bank of Vernon" → "vernon" → "vernon.com"
  const firstWord = clean.split(" ")[0];
  if (firstWord && firstWord !== noSpaces) {
    candidates.add(`${firstWord}.com`);
    candidates.add(`${firstWord}bank.com`);
  }

  return Array.from(candidates).slice(0, 4);
}

async function fetchPage(url: string, timeoutMs = 4000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!r.ok) return null;
    const text = await r.text();
    // Trim to first 30k chars — usually enough for header/footer + contact
    // section without inflating Claude tokens.
    return text.slice(0, 30_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Strip HTML to plain text-ish so Claude doesn't waste tokens on tags. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x?[0-9a-f]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

type ClaudeExtractedContact = {
  name: string;
  title: string;
  email: string;
  phone?: string;
  rationale?: string;
};

async function extractContactsWithClaude(args: {
  companyName: string;
  roleHint?: string;
  pages: Array<{ url: string; text: string }>;
}): Promise<{ contacts: ClaudeExtractedContact[]; sourceUrl: string; reason?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { contacts: [], sourceUrl: "", reason: "ANTHROPIC_API_KEY not set" };
  }
  if (args.pages.length === 0) {
    return { contacts: [], sourceUrl: "", reason: "no pages fetched" };
  }

  const client = new Anthropic({ apiKey });

  const pagesText = args.pages
    .map(
      (p, i) =>
        `<PAGE_${i + 1} url="${p.url}">\n${p.text.slice(0, 6000)}\n</PAGE_${i + 1}>`
    )
    .join("\n\n");

  const role = args.roleHint || "special assets, loan workout, recovery, collections, or charged-off receivables";
  const prompt = `You are extracting B2B corporate contacts from a bank or credit union's own public website.

Institution: ${args.companyName}
Looking for: contacts who handle ${role}

Below are HTML-stripped excerpts from the institution's site. Find up to 3 named contacts who match the role description above. Prefer department-level mailboxes (e.g. specialassets@bank.com) over generic ones (info@, hello@) when no named officer is listed.

STRICT RULES:
- Only return contacts whose role aligns with the target. Do NOT return tellers, branch managers, customer service, debtors, or random named individuals.
- Only return emails actually visible on the pages. Do NOT hallucinate addresses.
- If nothing fits, return an empty array — do not fall back to generic info@.

Pages:
${pagesText}

Respond with ONLY a JSON object in this exact shape:
{ "contacts": [{"name":"","title":"","email":"","phone":"","rationale":""}], "best_source_url": "" }

The "rationale" field explains in one short sentence why this person is the right contact.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    // Extract the first {...} block. Claude sometimes preambles a sentence.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { contacts: [], sourceUrl: "", reason: "no JSON in claude reply" };
    }
    const parsed = JSON.parse(match[0]) as {
      contacts?: ClaudeExtractedContact[];
      best_source_url?: string;
    };
    return {
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts.slice(0, 3) : [],
      sourceUrl: parsed.best_source_url || args.pages[0]?.url || "",
    };
  } catch (err) {
    return {
      contacts: [],
      sourceUrl: "",
      reason: (err as Error).message || "claude failed",
    };
  }
}

export async function resolveViaScrape(input: ResolveInput): Promise<ResolveResult> {
  const domains = input.domain ? [input.domain] : guessDomains(input.companyName);
  if (domains.length === 0) {
    return { contacts: [], enabled: true, reason: "could not derive domain from name" };
  }

  // Try the first domain that responds. We don't HEAD-probe — just hit the
  // first path; if it 404s for the next 5 paths we move to the next domain.
  for (const domain of domains) {
    const pages: Array<{ url: string; text: string }> = [];
    for (const path of CANDIDATE_PATHS) {
      if (pages.length >= 3) break; // 3 pages is plenty of context for Claude
      const url = `https://${domain}${path}`;
      const html = await fetchPage(url);
      if (!html) continue;
      const text = htmlToText(html);
      if (text.length < 200) continue; // not a real content page
      pages.push({ url, text });
    }

    if (pages.length === 0) continue;

    const { contacts, sourceUrl, reason } = await extractContactsWithClaude({
      companyName: input.companyName,
      roleHint: input.roleHint,
      pages,
    });

    if (contacts.length === 0) {
      // Successful scrape but no contacts found — return early rather than try
      // the next guessed domain, because the page existed.
      return { contacts: [], enabled: true, reason: reason || "extractor found nothing" };
    }

    return {
      enabled: true,
      contacts: contacts.map((c) => ({
        name: (c.name || "").trim(),
        title: (c.title || "").trim(),
        email: (c.email || "").trim().toLowerCase(),
        phone: c.phone?.trim() || undefined,
        sourceUrl: sourceUrl || pages[0]?.url || `https://${domain}`,
        tier: "scrape" as const,
        confidence: c.name ? 0.7 : 0.4,
      })),
    };
  }

  return { contacts: [], enabled: true, reason: "no candidate domain responded" };
}
