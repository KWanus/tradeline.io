import "server-only";

import { resolveViaApollo } from "./resolvers/apollo";
import { resolveViaScrape } from "./resolvers/scrape";
import type { ResolveInput, ResolveResult } from "./resolvers/types";

export type { ResolveInput, ResolveResult, ResolvedContact } from "./resolvers/types";

/**
 * Tiered contact resolver. Tries Apollo first (when APOLLO_API_KEY is set),
 * then falls through to the DIY scrape backend. The orchestrator never
 * surfaces "Apollo disabled" upstream — it just goes to the next tier.
 *
 * Design intent: adding a new backend later (e.g. RocketReach, Hunter) is a
 * single line — push it into the TIERS array.
 */
const TIERS: Array<(input: ResolveInput) => Promise<ResolveResult>> = [
  resolveViaApollo,
  resolveViaScrape,
];

export async function resolveContact(input: ResolveInput): Promise<ResolveResult> {
  const reasons: string[] = [];

  for (const tier of TIERS) {
    const r = await tier(input);
    if (!r.enabled) {
      reasons.push(r.reason || "tier disabled");
      continue;
    }
    if (r.contacts.length > 0) {
      return r;
    }
    reasons.push(r.reason || "no contacts at this tier");
  }

  return {
    enabled: true,
    contacts: [],
    reason: reasons.join(" · "),
  };
}
