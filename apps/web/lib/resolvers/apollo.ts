import "server-only";

import type { ResolveInput, ResolveResult, ResolvedContact } from "./types";

/**
 * Apollo.io people-search backend. Dormant by default — only fires when
 * APOLLO_API_KEY is set. When dormant, returns enabled=false so the
 * orchestrator falls through to the next tier silently.
 *
 * Wire-up later: set APOLLO_API_KEY in Vercel env, no other code change.
 */
export async function resolveViaApollo(input: ResolveInput): Promise<ResolveResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return { contacts: [], enabled: false, reason: "APOLLO_API_KEY not set" };
  }

  // Apollo's people search lets you filter by company name + (optionally) by
  // title keywords. We ask for up to 3 results to keep response time low.
  // Reference: https://docs.apollo.io/reference/people-search
  try {
    const titleKeywords = input.roleHint
      ? input.roleHint.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : ["Special Assets", "Loan Workout", "Recovery", "Collections"];

    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        q_organization_name: input.companyName,
        person_titles: titleKeywords,
        page: 1,
        per_page: 3,
      }),
    });

    if (!res.ok) {
      return {
        contacts: [],
        enabled: true,
        reason: `Apollo ${res.status}: ${(await res.text()).slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as {
      people?: Array<{
        first_name?: string;
        last_name?: string;
        title?: string;
        email?: string;
        phone_numbers?: Array<{ raw_number?: string }>;
        linkedin_url?: string;
      }>;
    };

    const contacts: ResolvedContact[] = (data.people || [])
      .filter((p) => p.email)
      .slice(0, 3)
      .map((p) => ({
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        title: p.title || "",
        email: p.email || "",
        phone: p.phone_numbers?.[0]?.raw_number,
        linkedinUrl: p.linkedin_url,
        sourceUrl: "https://app.apollo.io",
        tier: "apollo",
        confidence: 0.85,
      }));

    return { contacts, enabled: true };
  } catch (err) {
    return {
      contacts: [],
      enabled: true,
      reason: (err as Error).message || "apollo fetch failed",
    };
  }
}
