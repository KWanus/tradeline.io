// Curated state-rule changelog — surfaces consumer-debt regulatory changes
// that would affect operators when their licensed states + book composition
// intersect a recent reform.
//
// Source quality: every entry cites a public link (state legislature,
// CFPB, AG office, NCLC summary, etc.). Operator must confirm with counsel
// before relying on any of this for litigation or compliance posture —
// this is signal, not legal advice.
//
// V1 dataset focuses on the highest-impact reforms 2020-2026 that
// materially changed buyer/collector economics. To add entries: append
// to RULE_CHANGES with a stable id (state-yyyymmdd-slug) and bump the
// dataset version when adding meaningfully so caches invalidate.

export const RULE_CHANGES_VERSION = "2026-05-25";

export type RuleSeverity = "critical" | "high" | "moderate";

export type RuleCategory =
  | "sol" // statute of limitations
  | "medical_debt"
  | "licensing"
  | "validation" // Reg F-style itemization, validation notices
  | "fees" // post-judgment interest, fee caps
  | "enforcement" // notable AG / CFPB actions creating new operator obligations
  | "credit_reporting"; // FCRA / tradeline reporting changes

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  sol: "Statute of limitations",
  medical_debt: "Medical debt",
  licensing: "Licensing",
  validation: "Validation / itemization",
  fees: "Fees / interest",
  enforcement: "Enforcement",
  credit_reporting: "Credit reporting",
};

export type RuleChange = {
  id: string;
  state: string; // 2-letter state code, or "US" for federal
  dateEffective: string; // YYYY-MM-DD
  datePublished: string; // when the operator-facing world knew about it
  severity: RuleSeverity;
  category: RuleCategory;
  title: string;
  summary: string; // 1-3 sentences explaining the rule
  impact: string; // 1-2 sentences on what changes for the operator
  source: string; // URL
  // Affected asset classes (filter so a CC-only operator isn't alarmed by
  // a medical-debt rule). Empty array = applies to all.
  affectedAssetClasses?: string[];
};

// ---------------------------------------------------------------------------
// Dataset — curated. Add new entries at the top so newest reforms surface
// first when sorting by datePublished.
// ---------------------------------------------------------------------------

export const RULE_CHANGES: RuleChange[] = [
  {
    id: "ny-20221107-ccfa-sol-3yr",
    state: "NY",
    dateEffective: "2022-04-07",
    datePublished: "2021-11-08",
    severity: "critical",
    category: "sol",
    title: "Consumer Credit Fairness Act — NY SOL reduced to 3 years",
    summary:
      "Reduced consumer-debt statute of limitations from 6 years to 3 years and tightened pleading + notice requirements for collection lawsuits. Applies to all consumer-debt suits filed after the effective date.",
    impact:
      "Any NY paper aged 3+ years from last-payment date is now time-barred. Recompute SOL on every NY tape; cliff queue should treat the 3-year boundary as the hard line.",
    source: "https://www.nysenate.gov/legislation/bills/2021/s153",
  },
  {
    id: "ny-20220127-fcjia-interest",
    state: "NY",
    dateEffective: "2022-04-30",
    datePublished: "2022-01-27",
    severity: "high",
    category: "fees",
    title: "Fair Consumer Judgment Interest Act — post-judgment interest cut to 2%",
    summary:
      "Reduced post-judgment interest rate on consumer-debt judgments from 9% to 2% on judgments entered after the effective date.",
    impact:
      "NY judgment paper now compounds at 2%, not 9%. Recovery models that assumed the 9% post-judgment accrual need a haircut on NY judgment vintages — purchase prices that penciled at 9% no longer do at 2%.",
    source: "https://www.nysenate.gov/legislation/bills/2021/s5724",
  },
  {
    id: "us-20211130-reg-f",
    state: "US",
    dateEffective: "2021-11-30",
    datePublished: "2020-10-30",
    severity: "critical",
    category: "validation",
    title: "CFPB Regulation F took effect — debt collection rules overhauled",
    summary:
      "Validation notice must include 9 required data elements (itemization date + amount, current creditor, account number, etc.) plus a tear-off dispute form. 7-in-7 contact limits (no more than 7 calls per debt in 7 days). E-comm safe harbor with consent.",
    impact:
      "Every tape now needs Reg F minimum-field support to be legally collectable. Tape Copilot's Reg F check is the gate — failed checks should block placement until the seller supplements.",
    source: "https://www.consumerfinance.gov/rules-policy/regulations/1006/",
  },
  {
    id: "ca-20221101-dfpi-debt-collector-license",
    state: "CA",
    dateEffective: "2022-01-01",
    datePublished: "2020-09-25",
    severity: "critical",
    category: "licensing",
    title: "California DFPI debt-collector license required",
    summary:
      "Senate Bill 908 — every person who engages in collecting on consumer debt in California must hold a DFPI debt collector license + $25,000 surety bond. Includes debt buyers.",
    impact:
      "Without a current DFPI license, every CA account in a tape is uncollectable to you. The compliance shield should treat CA as unlicensed unless the operator has recorded the active license.",
    source: "https://dfpi.ca.gov/debt-collectors/",
  },
  {
    id: "us-20230701-medical-debt-cra-removal",
    state: "US",
    dateEffective: "2023-04-11",
    datePublished: "2022-03-18",
    severity: "high",
    category: "credit_reporting",
    title: "CRAs stopped reporting paid medical collections + raised threshold",
    summary:
      "The three nationwide CRAs (Equifax, Experian, TransUnion) stopped reporting paid medical-debt collections, extended the unpaid-medical reporting wait from 6mo to 12mo, and raised the minimum reportable unpaid balance to $500.",
    impact:
      "Sub-$500 medical paper has materially lower recovery — the credit-reporting leverage is gone. Bid floors for small-balance medical should drop significantly.",
    source:
      "https://www.equifax.com/newsroom/all-news/-/story/equifax-experian-and-transunion-support-u-s-consumers-with-changes-to-medical-collection-debt-reporting/",
    affectedAssetClasses: ["medical"],
  },
  {
    id: "ny-20231229-medical-debt-cra-ban",
    state: "NY",
    dateEffective: "2023-12-13",
    datePublished: "2023-12-13",
    severity: "critical",
    category: "credit_reporting",
    title: "NY banned medical debt from credit reports",
    summary:
      "Senate Bill S4907A bars consumer reporting agencies from including medical debt on consumer credit reports issued in NY. Includes hospital, dental, vision, and pharmacy debt.",
    impact:
      "NY medical paper is effectively soft-collect only — no credit-report leverage at all. Walk medical tapes heavy in NY exposure or discount face by 60%+ versus modeled recovery.",
    source: "https://www.nysenate.gov/legislation/bills/2023/s4907",
    affectedAssetClasses: ["medical"],
  },
  {
    id: "co-20230807-medical-debt-cra-ban",
    state: "CO",
    dateEffective: "2023-08-07",
    datePublished: "2023-06-05",
    severity: "high",
    category: "credit_reporting",
    title: "Colorado banned medical debt from credit reports",
    summary:
      "HB23-1126 prohibits consumer-reporting agencies from including medical-debt information in CO consumer credit reports. Aligns with NY trend.",
    impact:
      "Same as NY: CO medical paper loses CRA leverage. Discount or pass.",
    source:
      "https://leg.colorado.gov/bills/hb23-1126",
    affectedAssetClasses: ["medical"],
  },
  {
    id: "us-20250101-cfpb-medical-debt-rule",
    state: "US",
    dateEffective: "2025-03-17",
    datePublished: "2025-01-07",
    severity: "high",
    category: "credit_reporting",
    title: "CFPB Reg V — medical debt removed from all consumer reports",
    summary:
      "CFPB final rule under Regulation V removed medical debt from consumer credit reports nationwide and prohibited creditors from using medical-debt information in credit decisions.",
    impact:
      "National parallel to NY/CO bans. Every medical tape's recovery model now assumes zero CRA leverage. Recalibrate bids on medical paper portfolio-wide.",
    source:
      "https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-rule-to-remove-medical-bills-from-credit-reports/",
    affectedAssetClasses: ["medical"],
  },
  {
    id: "md-20220101-debt-buyer-licensing-enhancement",
    state: "MD",
    dateEffective: "2022-01-01",
    datePublished: "2021-04-13",
    severity: "high",
    category: "licensing",
    title: "Maryland enhanced debt-buyer licensing + collection requirements",
    summary:
      "HB 1077 expanded the Maryland Collection Agency Licensing Act to cover passive debt buyers and added new documentation requirements for any collection suit.",
    impact:
      "Without an MD collection-agency license, MD paper is not pursueable via litigation. Even soft-collect requires the license. Enhanced documentation = chain-of-custody reconciliation is critical for MD suits.",
    source:
      "https://mgaleg.maryland.gov/2021RS/bills/hb/hb1077T.pdf",
  },
  {
    id: "ma-20220301-debt-collection-rules-update",
    state: "MA",
    dateEffective: "2022-03-01",
    datePublished: "2021-12-30",
    severity: "moderate",
    category: "validation",
    title: "Massachusetts AG updated debt-collection regulations 940 CMR 7.00",
    summary:
      "Restructured contact frequency limits (no more than 2 outreach attempts per 7 days), added required disclosures, tightened validation-notice content rules. Stricter than federal Reg F.",
    impact:
      "MA outreach automation must respect 2-per-7-day limit. Autopilot cron should never queue more than 2 sends per 7d to the same MA consumer. Validation language requires MA-specific disclosure block.",
    source: "https://www.mass.gov/regulations/940-CMR-700-debt-collection-regulations",
  },
  {
    id: "ny-20240611-medical-judgment-ban",
    state: "NY",
    dateEffective: "2024-12-11",
    datePublished: "2024-06-11",
    severity: "moderate",
    category: "medical_debt",
    title: "NY Senate Bill S2823 — medical-debt liens + wage garnishment banned",
    summary:
      "Prohibits any lien against a primary residence and any wage garnishment based on a medical debt judgment. Doesn't ban suit, but eliminates the enforcement teeth.",
    impact:
      "NY medical judgments now have no real collection leverage. Even won suits can't garnish or lien. Treat as soft-collect-only.",
    source: "https://www.nysenate.gov/legislation/bills/2023/S2823",
    affectedAssetClasses: ["medical"],
  },
  {
    id: "ny-20240301-medical-fee-cap",
    state: "NY",
    dateEffective: "2025-01-01",
    datePublished: "2024-03-23",
    severity: "moderate",
    category: "fees",
    title: "NY medical-debt interest capped at 3%",
    summary:
      "Caps pre-judgment and post-judgment interest on consumer medical-debt judgments at 3%. Applies to debt incurred for personal medical services.",
    impact:
      "NY medical paper compounds at 3% max post-judgment (vs 2% general consumer per FCJIA, vs 9% historical). Recompute medical-debt recovery curves.",
    source: "https://www.nysenate.gov/legislation/bills/2023/A6275",
    affectedAssetClasses: ["medical"],
  },
];

// ---------------------------------------------------------------------------
// Acknowledgment storage — per-operator dismissal of individual rules
// ---------------------------------------------------------------------------

export const ACK_STORAGE_KEY = "tradeline.rule-changes.acks.v1";

export type RuleAcks = {
  acknowledgedIds: string[];
  lastUpdated: string;
};

export function readAcks(): RuleAcks {
  if (typeof window === "undefined") return { acknowledgedIds: [], lastUpdated: "" };
  try {
    const raw = window.localStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return { acknowledgedIds: [], lastUpdated: "" };
    const parsed = JSON.parse(raw) as RuleAcks;
    if (parsed && Array.isArray(parsed.acknowledgedIds)) return parsed;
    return { acknowledgedIds: [], lastUpdated: "" };
  } catch {
    return { acknowledgedIds: [], lastUpdated: "" };
  }
}

export function acknowledgeRule(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = readAcks();
    if (current.acknowledgedIds.includes(id)) return true;
    const next: RuleAcks = {
      acknowledgedIds: [...current.acknowledgedIds, id],
      lastUpdated: new Date().toISOString(),
    };
    window.localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function unacknowledgeRule(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = readAcks();
    if (!current.acknowledgedIds.includes(id)) return true;
    const next: RuleAcks = {
      acknowledgedIds: current.acknowledgedIds.filter((x) => x !== id),
      lastUpdated: new Date().toISOString(),
    };
    window.localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Relevance filtering
// ---------------------------------------------------------------------------

export type RelevantRulesInput = {
  // 2-letter state codes the operator cares about (their licensed states +
  // any state in their tape decode history, ideally).
  states: string[];
  // Optional: asset classes in the operator's book. When provided, rules
  // tagged with affectedAssetClasses are dropped if no overlap. When empty,
  // we treat as "any asset class."
  assetClasses?: string[];
  // Filter to changes effective within the last N days. Default unrestricted.
  recentDays?: number;
  // Drop already-acknowledged rules. Default true.
  includeAcknowledged?: boolean;
};

export type RelevantRule = RuleChange & {
  isAcknowledged: boolean;
  daysAgoEffective: number; // negative = future-dated reform not yet effective
};

const MS_PER_DAY = 86_400_000;

export function relevantRules(input: RelevantRulesInput): RelevantRule[] {
  const acks = new Set(readAcks().acknowledgedIds);
  const allStates = new Set([...input.states.map((s) => s.toUpperCase()), "US"]);
  const opAssetClasses = (input.assetClasses ?? []).map((a) => normalizeAssetClass(a));
  const includeAcked = input.includeAcknowledged ?? false;
  const cutoff = input.recentDays
    ? Date.now() - input.recentDays * MS_PER_DAY
    : null;
  const out: RelevantRule[] = [];
  for (const rule of RULE_CHANGES) {
    if (!allStates.has(rule.state.toUpperCase())) continue;
    if (
      rule.affectedAssetClasses &&
      rule.affectedAssetClasses.length > 0 &&
      opAssetClasses.length > 0 &&
      !rule.affectedAssetClasses.some((a) => opAssetClasses.includes(normalizeAssetClass(a)))
    ) {
      continue;
    }
    const effective = new Date(rule.dateEffective).getTime();
    if (cutoff !== null && effective < cutoff) continue;
    const isAcked = acks.has(rule.id);
    if (!includeAcked && isAcked) continue;
    const daysAgoEffective = Math.floor((Date.now() - effective) / MS_PER_DAY);
    out.push({ ...rule, isAcknowledged: isAcked, daysAgoEffective });
  }
  // Sort: critical first, then most recent effective date
  const sevOrder: Record<RuleSeverity, number> = {
    critical: 0,
    high: 1,
    moderate: 2,
  };
  out.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    if (s !== 0) return s;
    return new Date(b.dateEffective).getTime() - new Date(a.dateEffective).getTime();
  });
  return out;
}

function normalizeAssetClass(s: string): string {
  const d = s.toLowerCase();
  if (/credit\s*card|\bcc\b|revolving|charge\s*card/.test(d)) return "credit_card";
  if (/auto|vehicle/.test(d)) return "auto";
  if (/medical|hospital|healthcare/.test(d)) return "medical";
  if (/mortgage|heloc/.test(d)) return "mortgage";
  if (/student/.test(d)) return "student";
  if (/commercial|business|sba/.test(d)) return "commercial";
  if (/telecom|utility/.test(d)) return "telecom";
  if (/tax\s*lien/.test(d)) return "tax_lien";
  return d.replace(/\s+/g, "_");
}

// ---------------------------------------------------------------------------
// Tape-vs-rule matching
//
// Cross a decoded tape's state distribution + asset classes against the
// changelog. Returns rules where the tape has any matching face — with
// the affected-face-value and the list of matching states so the operator
// can see "$X face (Y%) of this tape sits in states where rule Z applies."
//
// Used by Tape Copilot to surface rule-change alerts inline with the bid
// decision (before the operator commits a number).
// ---------------------------------------------------------------------------

export type TapeStateDist = { state: string; faceValue: number };

export type TapeRuleMatch = RuleChange & {
  affectedFaceUsd: number;
  affectedPctOfTape: number;
  matchingStates: string[];
};

export function matchRulesToTape(input: {
  stateDistribution: TapeStateDist[];
  totalFaceValue: number;
  assetClasses: string[];
}): TapeRuleMatch[] {
  const faceByState = new Map<string, number>();
  for (const s of input.stateDistribution) {
    faceByState.set(s.state.toUpperCase(), (faceByState.get(s.state.toUpperCase()) ?? 0) + s.faceValue);
  }
  const opAssetClasses = input.assetClasses.map(normalizeAssetClass);
  const out: TapeRuleMatch[] = [];

  for (const rule of RULE_CHANGES) {
    // Asset-class filter: when a rule is asset-specific and the tape's
    // asset classes don't overlap, skip it.
    if (
      rule.affectedAssetClasses &&
      rule.affectedAssetClasses.length > 0 &&
      opAssetClasses.length > 0 &&
      !rule.affectedAssetClasses.some((a) => opAssetClasses.includes(normalizeAssetClass(a)))
    ) {
      continue;
    }

    let affectedFace = 0;
    let matchingStates: string[] = [];

    if (rule.state === "US") {
      // Federal rule — applies to the whole tape (any state)
      affectedFace = input.totalFaceValue;
      matchingStates = Array.from(faceByState.keys()).sort();
    } else {
      const stateFace = faceByState.get(rule.state.toUpperCase()) ?? 0;
      if (stateFace > 0) {
        affectedFace = stateFace;
        matchingStates = [rule.state.toUpperCase()];
      }
    }

    if (affectedFace > 0) {
      out.push({
        ...rule,
        affectedFaceUsd: affectedFace,
        affectedPctOfTape:
          input.totalFaceValue > 0 ? (affectedFace / input.totalFaceValue) * 100 : 0,
        matchingStates,
      });
    }
  }

  // Sort: critical first, then by affected face value desc
  const sevOrder: Record<RuleSeverity, number> = {
    critical: 0,
    high: 1,
    moderate: 2,
  };
  out.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    if (s !== 0) return s;
    return b.affectedFaceUsd - a.affectedFaceUsd;
  });
  return out;
}
