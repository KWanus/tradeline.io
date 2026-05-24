/**
 * Shared types for contact-resolver backends.
 *
 * Resolvers (Apollo, scrape, etc.) all accept the same input and return the
 * same shape so the orchestrator can stack them as pluggable tiers without
 * the caller knowing which one answered.
 */

export type ResolveInput = {
  /** Stable per-bank identifier ("WAL", "fdic-51", "ncua-1") used for caching. */
  bankKey: string;
  /** Display name of the institution. */
  companyName: string;
  /** Optional explicit domain ("webster.com"). When omitted the resolver may
   * fall back to a heuristic guess from companyName. */
  domain?: string;
  /** Optional context hint about what role you're looking for. E.g.
   * "special assets, loan workout, charged-off receivables." Pure text — used
   * by the LLM extractor to rank candidates. */
  roleHint?: string;
};

export type ResolvedContact = {
  /** Best-guess full name; may be "" if only a generic mailbox was found. */
  name: string;
  /** Title / role at the institution if extracted. */
  title: string;
  /** Verified email address. */
  email: string;
  /** Optional phone number. */
  phone?: string;
  /** Optional LinkedIn profile URL. */
  linkedinUrl?: string;
  /** Where the resolver found this — URL of the page or API source. */
  sourceUrl: string;
  /** Which backend produced it: "apollo" | "scrape" | "manual". */
  tier: "apollo" | "scrape" | "manual";
  /** 0-1 score from the resolver — heuristic, not authoritative. */
  confidence: number;
};

export type ResolveResult = {
  /** Up to 3 candidate contacts, best first. Empty when nothing found. */
  contacts: ResolvedContact[];
  /** True if the resolver was even enabled (e.g. Apollo without API key
   * returns enabled=false so the orchestrator can fall through silently). */
  enabled: boolean;
  /** Optional diagnostic, surfaced in API responses for debugging. */
  reason?: string;
};
