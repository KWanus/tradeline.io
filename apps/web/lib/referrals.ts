/**
 * Referral desk — the loan-brokering revenue line that sits next to debt-buying.
 *
 * You are NOT the lender and you do NOT pull anyone's credit. You introduce a
 * real business that genuinely needs financing to a lender partner, the lender
 * underwrites and funds, and you collect a referral commission out of the
 * lender's gain. Legal, no capital at risk, no FCRA exposure — provided every
 * business and every number is real. Manufacturing a borrower or its history
 * to get a deal funded is loan fraud; this desk only works with real leads.
 *
 * Lender programs below are public companies that run referral / partner /
 * affiliate programs. Commission percentages are PLANNING APPROXIMATIONS — they
 * vary by program tier, deal size, and current promos. Confirm the live rate
 * with each program before quoting yourself a number.
 */

export type LenderProgram = {
  name: string;
  shortName: string;
  url: string;
  product:
    | "marketplace"
    | "sba"
    | "line-of-credit"
    | "term-loan"
    | "equipment"
    | "invoice";
  /** What the program funds, in plain language. */
  fundsLabel: string;
  minMonthsInBusiness: number;
  minMonthlyRevenueUsd: number;
  /** Funding amount range the program typically writes. */
  amountRange: string;
  /** Approx referral commission as % of funded amount (planning midpoint). */
  commissionPct: number;
  /** Human-readable commission range. */
  commissionLabel: string;
  /** How and when the referral fee is paid. */
  payout: string;
  notes: string;
  applyPath: string;
};

export const PRODUCT_LABEL: Record<LenderProgram["product"], string> = {
  marketplace: "Loan marketplace",
  sba: "SBA loan",
  "line-of-credit": "Line of credit",
  "term-loan": "Term loan",
  equipment: "Equipment finance",
  invoice: "Invoice / AR finance",
};

// Curated as of 2026-05-22. Names + URLs are public; revenue/tenure minimums
// and commission ranges are starting approximations — verify on the program's
// current partner page before relying on a number.
export const LENDER_PROGRAMS: LenderProgram[] = [
  {
    name: "Lendio — Affiliate / Referral Program",
    shortName: "Lendio",
    url: "https://www.lendio.com/affiliates/",
    product: "marketplace",
    fundsLabel: "Almost anything — routes one application to 75+ lenders",
    minMonthsInBusiness: 6,
    minMonthlyRevenueUsd: 8000,
    amountRange: "$5k – $5M",
    commissionPct: 2,
    commissionLabel: "≈ flat $ per funded deal, scales with size",
    payout: "Paid after the borrower's loan funds; tracked via affiliate link",
    notes:
      "Best first partner — the marketplace does the lender-matching for you, so a wide range of businesses qualifies somewhere. Lower per-deal payout than direct, but the highest fill rate.",
    applyPath: "Apply to the affiliate program online; approval is fast",
  },
  {
    name: "SmartBiz — SBA Loan Referral",
    shortName: "SmartBiz",
    url: "https://www.smartbizloans.com/",
    product: "sba",
    fundsLabel: "SBA 7(a) loans — working capital, debt refi, real estate",
    minMonthsInBusiness: 24,
    minMonthlyRevenueUsd: 10000,
    amountRange: "$30k – $5M",
    commissionPct: 1.5,
    commissionLabel: "≈ 1–2% of funded amount on SBA deals",
    payout: "Paid on funding; SBA deals take 30–60 days to close",
    notes:
      "Highest-quality borrowers and biggest tickets, but slow and strict — needs 2+ years in business and clean books. One funded SBA deal can be worth ten small ones.",
    applyPath: "Partner program inquiry via their site",
  },
  {
    name: "Bluevine — Partner Program",
    shortName: "Bluevine",
    url: "https://www.bluevine.com/partners",
    product: "line-of-credit",
    fundsLabel: "Revolving line of credit + business checking",
    minMonthsInBusiness: 12,
    minMonthlyRevenueUsd: 10000,
    amountRange: "$6k – $250k",
    commissionPct: 2.5,
    commissionLabel: "≈ flat referral fee per funded line",
    payout: "Paid once the line is drawn",
    notes:
      "Fast decisions, popular with established small businesses that want a credit cushion rather than a lump sum. Good middle-of-funnel partner.",
    applyPath: "Apply to the partner program online",
  },
  {
    name: "OnDeck — Referral / Partner Program",
    shortName: "OnDeck",
    url: "https://www.ondeck.com/partners",
    product: "term-loan",
    fundsLabel: "Short-term loans and lines for working capital",
    minMonthsInBusiness: 12,
    minMonthlyRevenueUsd: 8500,
    amountRange: "$5k – $250k",
    commissionPct: 3,
    commissionLabel: "≈ 1–4% of funded amount",
    payout: "Paid on funding; decisions often same-day",
    notes:
      "Funds fast and approves thinner files than a bank. Higher borrower cost — only route a business here when speed matters more than rate.",
    applyPath: "Partner program application online",
  },
  {
    name: "Fundbox — Partner Program",
    shortName: "Fundbox",
    url: "https://fundbox.com/",
    product: "line-of-credit",
    fundsLabel: "Line of credit for newer / thinner-file businesses",
    minMonthsInBusiness: 6,
    minMonthlyRevenueUsd: 8000,
    amountRange: "$1k – $150k",
    commissionPct: 2,
    commissionLabel: "≈ flat fee per funded line",
    payout: "Paid on first draw",
    notes:
      "Lowest bar to qualify — the catch-all for young businesses a bank would decline. Small tickets, but it fills deals nothing else will.",
    applyPath: "Partner inquiry via their site",
  },
  {
    name: "National Funding — Referral Program",
    shortName: "National Funding",
    url: "https://www.nationalfunding.com/",
    product: "equipment",
    fundsLabel: "Equipment financing + working-capital loans",
    minMonthsInBusiness: 6,
    minMonthlyRevenueUsd: 8000,
    amountRange: "$5k – $500k",
    commissionPct: 3,
    commissionLabel: "≈ 2–5% of funded amount",
    payout: "Paid on funding",
    notes:
      "Strong for any business buying a physical asset — trucks, kitchen gear, machinery. The equipment itself is collateral, so approvals are easier.",
    applyPath: "Referral partner sign-up online",
  },
  {
    name: "Balboa Capital — Broker / Referral Program",
    shortName: "Balboa",
    url: "https://www.balboacapital.com/",
    product: "equipment",
    fundsLabel: "Equipment leasing + small-business loans",
    minMonthsInBusiness: 12,
    minMonthlyRevenueUsd: 10000,
    amountRange: "$10k – $500k",
    commissionPct: 3,
    commissionLabel: "≈ 2–5% of funded amount",
    payout: "Paid on funding",
    notes:
      "Established equipment-finance shop with a real broker channel. Better tickets than National Funding, slightly higher tenure bar.",
    applyPath: "Broker program application online",
  },
  {
    name: "FundThrough — Invoice Factoring Referral",
    shortName: "FundThrough",
    url: "https://www.fundthrough.com/",
    product: "invoice",
    fundsLabel: "Advances against unpaid B2B invoices",
    minMonthsInBusiness: 3,
    minMonthlyRevenueUsd: 5000,
    amountRange: "$500 – $10M",
    commissionPct: 2,
    commissionLabel: "≈ flat referral fee per funded client",
    payout: "Paid once the first invoice is advanced",
    notes:
      "For businesses that are profitable but cash-starved because customers pay slowly. Lowest tenure bar here — what matters is the quality of who owes them.",
    applyPath: "Referral partner sign-up online",
  },
];

/** A logged business borrower moving through the referral pipeline. */
export type Referral = {
  id: string;
  business: string;
  contact: string;
  monthsInBusiness: number;
  monthlyRevenueUsd: number;
  amountNeededUsd: number;
  useOfFunds: string;
  creditBand: CreditBand;
  /** Where this lead came from — drives the source-performance panel. */
  source: LeadSource;
  status: ReferralStatus;
  /** shortName of the lender program this lead was routed to. */
  lenderShortName: string;
  /** Actual amount the lender funded — set when status flips to funded. */
  fundedAmountUsd: number;
  /** Actual commission earned — set when status flips to funded. */
  commissionUsd: number;
  note: string;
  createdAt: string;
};

export type CreditBand = "strong" | "fair" | "thin" | "unknown";

/** Where a lead was sourced — the channels this business already has. */
export type LeadSource =
  | "customers"
  | "subscribers"
  | "banks"
  | "network"
  | "outreach"
  | "repeat"
  | "other";

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  customers: "Customer list",
  subscribers: "Subscriber list",
  banks: "Bank relationship",
  network: "Personal network",
  outreach: "Cold outreach",
  repeat: "Word of mouth / past borrower",
  other: "Other",
};

export const LEAD_SOURCE_ORDER: LeadSource[] = [
  "customers",
  "subscribers",
  "banks",
  "network",
  "outreach",
  "repeat",
  "other",
];

export type ReferralStatus =
  | "lead"
  | "matched"
  | "submitted"
  | "funded"
  | "declined";

export const CREDIT_BAND_LABEL: Record<CreditBand, string> = {
  strong: "Strong credit",
  fair: "Fair credit",
  thin: "Thin / new file",
  unknown: "Unknown",
};

export const STATUS_LABEL: Record<ReferralStatus, string> = {
  lead: "New lead",
  matched: "Matched to lender",
  submitted: "Submitted",
  funded: "Funded — paid",
  declined: "Declined",
};

export const STATUS_ORDER: ReferralStatus[] = [
  "lead",
  "matched",
  "submitted",
  "funded",
  "declined",
];

export const REFERRALS_KEY = "tradeline.referrals.v1";

export function readReferrals(): Referral[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REFERRALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Referral[]) : [];
  } catch {
    return [];
  }
}

export function writeReferrals(all: Referral[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REFERRALS_KEY, JSON.stringify(all));
  } catch {}
}

export type LenderMatch = {
  program: LenderProgram;
  /** Estimated commission if this program funds the amount needed. */
  estCommissionUsd: number;
};

export type ReferralScore = {
  /** 0–100 — how likely this lead is to fund somewhere. */
  score: number;
  band: "strong" | "workable" | "weak";
  reasons: string[];
  /** Programs whose tenure + revenue bars this business clears, best payout first. */
  matches: LenderMatch[];
  /** Commission if the best-payout match funds the full amount. */
  estCommissionUsd: number;
};

export type ScoreInput = {
  monthsInBusiness: number;
  monthlyRevenueUsd: number;
  amountNeededUsd: number;
  creditBand: CreditBand;
};

/**
 * Score a business borrower for fundability and route it to lender programs.
 * Pure — drives both the desk UI and any future API.
 */
export function scoreReferral(
  input: ScoreInput,
  programs: LenderProgram[] = LENDER_PROGRAMS
): ReferralScore {
  const { monthsInBusiness, monthlyRevenueUsd, amountNeededUsd, creditBand } =
    input;

  const matches: LenderMatch[] = programs
    .filter(
      (p) =>
        monthsInBusiness >= p.minMonthsInBusiness &&
        monthlyRevenueUsd >= p.minMonthlyRevenueUsd
    )
    .map((p) => ({
      program: p,
      estCommissionUsd: Math.round(
        (amountNeededUsd * p.commissionPct) / 100
      ),
    }))
    .sort((a, b) => b.estCommissionUsd - a.estCommissionUsd);

  const reasons: string[] = [];

  // Revenue — the single biggest fundability signal.
  let revPts = 4;
  if (monthlyRevenueUsd >= 50000) revPts = 30;
  else if (monthlyRevenueUsd >= 20000) revPts = 24;
  else if (monthlyRevenueUsd >= 10000) revPts = 18;
  else if (monthlyRevenueUsd >= 5000) revPts = 10;
  if (monthlyRevenueUsd < 5000)
    reasons.push("Revenue under $5k/mo — most programs won't fund.");

  // Time in business — proves the business survived.
  let tenurePts = 0;
  if (monthsInBusiness >= 24) tenurePts = 30;
  else if (monthsInBusiness >= 12) tenurePts = 22;
  else if (monthsInBusiness >= 6) tenurePts = 14;
  else if (monthsInBusiness >= 3) tenurePts = 6;
  if (monthsInBusiness < 6)
    reasons.push("Under 6 months in business — only Fundbox / FundThrough fit.");

  // Credit band.
  const creditPts: Record<CreditBand, number> = {
    strong: 25,
    fair: 16,
    thin: 8,
    unknown: 10,
  };
  if (creditBand === "thin")
    reasons.push("Thin credit file caps the rate — route to flexible lenders.");

  // Breadth of fit — more matches means a deal is more likely to close.
  const matchPts = (Math.min(matches.length, 5) / 5) * 15;
  if (matches.length === 0)
    reasons.push("No program's minimums are met — not referable yet.");
  else if (matches.length >= 4)
    reasons.push(`Clears ${matches.length} programs — easy to place.`);

  const score = Math.round(
    revPts + tenurePts + creditPts[creditBand] + matchPts
  );

  let band: ReferralScore["band"] = "weak";
  if (score >= 70 && matches.length > 0) band = "strong";
  else if (score >= 40 && matches.length > 0) band = "workable";

  if (band === "strong" && reasons.length === 0)
    reasons.push("Clean file — submit to the best-payout match now.");

  return {
    score,
    band,
    reasons,
    matches,
    estCommissionUsd: matches[0]?.estCommissionUsd ?? 0,
  };
}

export function programByShortName(
  shortName: string
): LenderProgram | undefined {
  return LENDER_PROGRAMS.find((p) => p.shortName === shortName);
}

/** Per-channel performance — how many leads, how many funded, what they paid. */
export type SourceStat = {
  source: LeadSource;
  total: number;
  funded: number;
  /** Commission actually banked from this channel. */
  earnedUsd: number;
  /** Estimated fees still live in the pipeline from this channel. */
  pipelineUsd: number;
  /** funded / total, 0–1. */
  closeRate: number;
};

/**
 * Aggregate referrals by lead source so the operator can see which channel
 * actually produces funded deals — and stop spending time on the ones that
 * never close. Sorted by money earned, then by lead volume.
 */
export function sourcePerformance(referrals: Referral[]): SourceStat[] {
  const map = new Map<LeadSource, SourceStat>();
  for (const r of referrals) {
    const source: LeadSource = r.source || "other";
    const stat: SourceStat =
      map.get(source) ?? {
        source,
        total: 0,
        funded: 0,
        earnedUsd: 0,
        pipelineUsd: 0,
        closeRate: 0,
      };
    stat.total += 1;
    if (r.status === "funded") {
      stat.funded += 1;
      stat.earnedUsd += r.commissionUsd || 0;
    } else if (r.status !== "declined") {
      stat.pipelineUsd += scoreReferral(r).estCommissionUsd;
    }
    map.set(source, stat);
  }
  for (const stat of map.values()) {
    stat.closeRate = stat.total > 0 ? stat.funded / stat.total : 0;
  }
  return [...map.values()].sort(
    (a, b) => b.earnedUsd - a.earnedUsd || b.total - a.total
  );
}
