export type Broker = {
  name: string;
  shortName: string;
  url: string;
  type: "auction-platform" | "broker" | "broker-principal" | "boutique";
  assetClass: string[];
  cadence: string;
  typicalDealSize: string;
  notes: string;
  contactPath: string;
};

// Curated directory of major US NPL brokers / auction platforms.
// Names are public, descriptions are intentionally generic — relationships
// and current cadence change quickly. Verify before approaching.
//
// This list is a starting map, not gospel. The Year-2 plan is to make
// this a live database that tracks each broker's actual posting cadence
// against our own seed banks.
export const BROKERS: Broker[] = [
  {
    name: "NLEX (National Loan Exchange)",
    shortName: "NLEX",
    url: "https://www.nlex.com/",
    type: "auction-platform",
    assetClass: ["credit card", "auto", "consumer", "commercial", "judgments"],
    cadence: "Continuous postings; multiple per week",
    typicalDealSize: "$500k – $200M face",
    notes:
      "Largest electronic NPL auction platform in the US. Most fresh-from-bank paper for major originators routes through here. Buyer-panel registration required; expect KYC + license attestation + minimum capital.",
    contactPath: "Apply via website; relationship begins after KYC review",
  },
  {
    name: "Garnet Capital Advisors",
    shortName: "Garnet",
    url: "https://garnetcapital.com/",
    type: "broker-principal",
    assetClass: ["credit card", "consumer", "commercial", "specialty"],
    cadence: "1–3 deals per month",
    typicalDealSize: "$1M – $500M face",
    notes:
      "Acts as both broker and principal. Sees a lot of mid-market regional bank paper. Reputation-driven — they prefer dealing with buyers they’ve transacted with before.",
    contactPath: "Direct relationship build via conferences (RMAI / DBA / receivables roundup)",
  },
  {
    name: "RMG Investments",
    shortName: "RMG",
    url: "https://www.rmgi.com/",
    type: "broker",
    assetClass: ["credit card", "auto", "consumer"],
    cadence: "Weekly postings",
    typicalDealSize: "$1M – $50M face",
    notes:
      "Long-standing broker with deep ties to mid-tier banks. Known for cleaner-than-average tape documentation.",
    contactPath: "Direct outreach + buyer registration form",
  },
  {
    name: "Kondaur Capital",
    shortName: "Kondaur",
    url: "https://www.kondaur.com/",
    type: "broker-principal",
    assetClass: ["junior mortgage", "second-lien", "real estate notes"],
    cadence: "Bid-list cycles, monthly",
    typicalDealSize: "$5M – $200M face",
    notes:
      "Specializes in secured residential paper. Year-2 relevance — secured paper is the hypothecation play.",
    contactPath: "Bid-list registration; KYC heavy",
  },
  {
    name: "IndustryUp / DebtConnect",
    shortName: "DebtConnect",
    url: "https://www.industryup.com/",
    type: "auction-platform",
    assetClass: ["credit card", "auto", "consumer", "specialty"],
    cadence: "Continuous listings",
    typicalDealSize: "$250k – $50M face",
    notes:
      "Middle-market platform. More accessible to smaller buyers than NLEX. Good first-deal venue once licensed.",
    contactPath: "Online registration",
  },
  {
    name: "Cascade360 / Pacific Equity",
    shortName: "Cascade",
    url: "https://www.cascade360.com/",
    type: "broker",
    assetClass: ["auto", "subprime auto"],
    cadence: "Monthly bid-list",
    typicalDealSize: "$2M – $100M face",
    notes: "Auto-NPL specialist. Relevant if Tradeline’s buyer-arm enters secured auto in Year 2.",
    contactPath: "Direct outreach",
  },
  {
    name: "RSI (Receivables Specialists International)",
    shortName: "RSI",
    url: "https://rsireceivables.com/",
    type: "broker",
    assetClass: ["medical", "consumer"],
    cadence: "Weekly",
    typicalDealSize: "$500k – $25M face",
    notes:
      "Medical debt specialist. Heavily regulated category — confirm Reg F + state-level medical-debt rules before pursuing.",
    contactPath: "Buyer registration",
  },
  {
    name: "DebtNext",
    shortName: "DebtNext",
    url: "https://www.debtnext.com/",
    type: "auction-platform",
    assetClass: ["credit card", "auto", "consumer"],
    cadence: "Continuous",
    typicalDealSize: "$500k – $50M face",
    notes:
      "Software platform that also brokers deals. Good source for first-time buyers learning the auction mechanics.",
    contactPath: "Online registration",
  },
  {
    name: "Phoenix Asset Management",
    shortName: "Phoenix",
    url: "https://www.phoenixrec.com/",
    type: "boutique",
    assetClass: ["credit card", "consumer"],
    cadence: "Periodic, relationship-driven",
    typicalDealSize: "$1M – $25M face",
    notes: "Smaller boutique broker; relationships matter more than platform.",
    contactPath: "Direct introduction preferred",
  },
];

export const BROKER_TYPE_LABEL: Record<Broker["type"], string> = {
  "auction-platform": "Auction platform",
  broker: "Broker",
  "broker-principal": "Broker / principal",
  boutique: "Boutique",
};
