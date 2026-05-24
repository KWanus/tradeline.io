/**
 * HQ state for each SEC-tracked bank in `data/seed/banks.csv`. Used to apply
 * state-risk warnings to SEC outreach cards — only for tiers where loan-book
 * geography is concentrated enough to matter (regional / specialty / fintech /
 * mortgage / student). GSIB and super-regional tiers carry nationally
 * diversified loan books and don't get a state-risk treatment even when the
 * HQ state is in a tough-law jurisdiction.
 *
 * Source: SEC filings + corporate websites, public knowledge as of 2026.
 * Missing tickers fall back to no state-risk treatment (gracefully).
 */

export const SEC_BANK_HQ_STATE: Record<string, string> = {
  // GSIB / super-regional — recorded for completeness, but enrichSecOriginator
  // intentionally does NOT apply state-risk for these tiers since their loan
  // books are nationally distributed.
  JPM: "NY",
  BAC: "NC",
  C: "NY",
  WFC: "CA",
  GS: "NY",
  MS: "NY",
  USB: "MN",
  PNC: "PA",
  TFC: "NC",
  COF: "VA",
  DFS: "IL",
  SYF: "CT",
  ALLY: "UT",
  CFG: "RI",

  // Regional — geographic concentration starts to matter here.
  KEY: "OH",
  FITB: "OH",
  RF: "AL",
  MTB: "NY",
  HBAN: "OH",
  NTRS: "IL",
  BK: "NY",
  STT: "MA",
  CMA: "TX",
  ZION: "UT",
  FHN: "TN",
  WAL: "AZ",
  WBS: "CT",
  FLG: "MI",
  EWBC: "CA",
  SNV: "GA",
  PB: "TX",
  FCNCA: "NC",
  PNFP: "TN",
  CFR: "TX",
  BOKF: "OK",
  CBSH: "MO",
  ONB: "IN",
  FNB: "PA",
  UMBF: "MO",
  SSB: "SC",
  VLY: "NJ",
  NWBI: "PA",
  HOMB: "AR",

  // Fintech / specialty / mortgage / student — concentration varies but
  // state-risk is meaningful where present (CA-headquartered fintechs see
  // CA loan concentration).
  SOFI: "CA",
  UPST: "CA",
  AFRM: "CA",
  LC: "CA",
  PGY: "NY",
  OPRT: "CA",
  OMF: "IN",
  CACC: "MI",
  WRLD: "SC",
  RKT: "MI",
  PFSI: "CA",
  NLY: "NY",
  NAVI: "VA",
  SLM: "DE",
};

/** Tiers where state-risk is meaningfully concentrated. GSIB and
 * super-regional are excluded — their loan books are nationally diversified
 * enough that single-state legal friction doesn't move the bid math. */
const TIERS_WITH_STATE_RISK = new Set([
  "regional",
  "specialty",
  "fintech",
  "mortgage",
  "student",
]);

export function shouldApplyStateRisk(tier: string | null | undefined): boolean {
  if (!tier) return false;
  return TIERS_WITH_STATE_RISK.has(tier);
}

export function secBankState(ticker: string): string | null {
  return SEC_BANK_HQ_STATE[ticker.toUpperCase()] ?? null;
}
