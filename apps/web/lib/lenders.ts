export type Lender = {
  name: string;
  shortName: string;
  url: string;
  type: "bank" | "specialty-credit" | "private-credit" | "warehouse" | "boutique";
  collateralFocus: string[];
  advanceRateRange: string;
  minSeasoningMonths: number;
  ticketRange: string;
  notes: string;
  contactPath: string;
};

// Curated directory of US lenders that take re-performing notes (RPN) and
// secured paper as collateral. Names are public, but advance rates and ticket
// sizes are starting approximations — verify before approaching.
//
// Categories:
//   bank: regulated commercial bank with NPL desk
//   specialty-credit: NPL/RPN-focused specialty lender
//   private-credit: PC fund or BDC with NPL allocation
//   warehouse: master-line / warehouse facility
//   boutique: smaller relationship lender
export const LENDERS: Lender[] = [
  {
    name: "Webster Bank — Specialty Lending",
    shortName: "Webster",
    url: "https://www.websterbank.com/",
    type: "bank",
    collateralFocus: ["junior mortgage", "secured consumer", "performing notes"],
    advanceRateRange: "60–75% on secured · 30–45% on RPN",
    minSeasoningMonths: 12,
    ticketRange: "$5M – $50M",
    notes:
      "Long-running NPL specialty desk. Conservative underwriting; expects audited collection history. Best fit once you have $5M+ in seasoned portfolios.",
    contactPath: "Direct introduction via your CPA or attorney is typical",
  },
  {
    name: "TIAA Bank / TIAA Direct",
    shortName: "TIAA",
    url: "https://www.tiaa.org/public/learn/personal-finance-101",
    type: "bank",
    collateralFocus: ["junior mortgage", "real estate notes"],
    advanceRateRange: "55–70% on secured paper",
    minSeasoningMonths: 12,
    ticketRange: "$2M – $25M",
    notes:
      "Mostly secured-paper focus. Well-suited for buyers transitioning from unsecured CC into secured collateral.",
    contactPath: "Relationship via specialty broker (Garnet, Kondaur)",
  },
  {
    name: "Brevet Capital",
    shortName: "Brevet",
    url: "https://www.brevet.com/",
    type: "private-credit",
    collateralFocus: ["receivables", "specialty consumer", "court judgments"],
    advanceRateRange: "40–60% blended",
    minSeasoningMonths: 9,
    ticketRange: "$10M – $100M",
    notes:
      "Specialty credit fund; known for receivables and judgment-backed financing. Higher cost of capital than banks, but more flexible on collateral type.",
    contactPath: "Industry conference connections; LPs introduce buyers",
  },
  {
    name: "Fortress Investment Group",
    shortName: "Fortress",
    url: "https://www.fortress.com/",
    type: "private-credit",
    collateralFocus: ["NPL portfolios", "secured paper", "consumer"],
    advanceRateRange: "50–70% on secured · selective on unsecured",
    minSeasoningMonths: 12,
    ticketRange: "$25M+ typically",
    notes:
      "Major institutional NPL investor; also lends. Door is hard to open below ~$25M. Will buy paper outright if the deal is large enough.",
    contactPath: "Investment-banker introduction; direct cold outreach rarely lands",
  },
  {
    name: "Atalaya Capital Management",
    shortName: "Atalaya",
    url: "https://atalayacap.com/",
    type: "private-credit",
    collateralFocus: ["NPL", "consumer receivables", "specialty finance"],
    advanceRateRange: "45–65% blended",
    minSeasoningMonths: 9,
    ticketRange: "$10M – $200M",
    notes:
      "Active in specialty consumer credit. Strong appetite for portfolios with documented collection history.",
    contactPath: "Relationship-driven; usually broker-introduced",
  },
  {
    name: "Garrison Investment Group",
    shortName: "Garrison",
    url: "https://www.garrisoninv.com/",
    type: "private-credit",
    collateralFocus: ["NPL", "second-lien", "performing receivables"],
    advanceRateRange: "40–60%",
    minSeasoningMonths: 12,
    ticketRange: "$15M – $100M",
    notes: "Multi-strategy credit fund. Selective. Strong in junior mortgages.",
    contactPath: "Investment-banker introduction",
  },
  {
    name: "Kondaur Capital — financing arm",
    shortName: "Kondaur Capital (financing)",
    url: "https://www.kondaur.com/",
    type: "specialty-credit",
    collateralFocus: ["junior mortgage", "second-lien", "real estate notes"],
    advanceRateRange: "55–75% on residential secured",
    minSeasoningMonths: 12,
    ticketRange: "$5M – $50M",
    notes:
      "Same firm as the broker; their financing arm takes secured residential paper as collateral. Useful if you already have a buy-side relationship with them.",
    contactPath: "Direct via existing Kondaur relationship",
  },
  {
    name: "First Foundation Bank — Specialty Lending",
    shortName: "First Foundation",
    url: "https://www.firstfoundationinc.com/",
    type: "bank",
    collateralFocus: ["specialty receivables", "secured consumer"],
    advanceRateRange: "50–65% on secured",
    minSeasoningMonths: 12,
    ticketRange: "$3M – $25M",
    notes:
      "Smaller bank with a flexible specialty-lending desk. Better fit for first-time leveraged buyers than the large incumbents.",
    contactPath: "Direct outreach via specialty banker",
  },
  {
    name: "FCO (Forge Credit Operations) — warehouse",
    shortName: "FCO",
    url: "",
    type: "warehouse",
    collateralFocus: ["master line for NPL operators"],
    advanceRateRange: "50–65% on diversified collateral pool",
    minSeasoningMonths: 6,
    ticketRange: "$10M – $75M",
    notes:
      "Boutique warehouse-line provider; takes a diversified pool as collateral and lets you draw against it. Good fit once you have 3+ portfolios from different vintages.",
    contactPath: "Industry referral",
  },
  {
    name: "RCAP / Receivables Capital Partners",
    shortName: "RCAP",
    url: "",
    type: "boutique",
    collateralFocus: ["medical debt", "specialty consumer"],
    advanceRateRange: "30–45% on unsecured",
    minSeasoningMonths: 12,
    ticketRange: "$2M – $20M",
    notes:
      "Smaller boutique. Useful early-stage relationship — willing to underwrite lower ticket sizes than major banks.",
    contactPath: "Relationship introduction at RMAI",
  },
];

export const LENDER_TYPE_LABEL: Record<Lender["type"], string> = {
  bank: "Commercial bank",
  "specialty-credit": "Specialty NPL credit",
  "private-credit": "Private credit fund",
  warehouse: "Warehouse line",
  boutique: "Boutique relationship",
};
