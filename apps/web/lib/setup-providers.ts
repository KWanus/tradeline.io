export type ProviderCategory =
  | "registered-agent"
  | "bank"
  | "surety-bond"
  | "insurance"
  | "attorney"
  | "cpa"
  | "ein-formation";

export type Provider = {
  category: ProviderCategory;
  name: string;
  url: string;
  costRange: string;
  beginnerFriendly: boolean;
  notes: string;
};

export const CATEGORY_LABEL: Record<ProviderCategory, string> = {
  "registered-agent": "Registered agent",
  bank: "Business bank account",
  "surety-bond": "Surety bond carrier",
  insurance: "Business insurance",
  attorney: "Consumer-finance attorney",
  cpa: "CPA / accountant",
  "ein-formation": "LLC formation + EIN",
};

export const CATEGORY_DESCRIPTION: Record<ProviderCategory, string> = {
  "ein-formation":
    "Forms your LLC and gets you a federal EIN. The first thing you set up — everything else uses your LLC name and EIN.",
  "registered-agent":
    "A required 'mailbox' that receives legal notices for your LLC in the state you formed in. Required by law in every state.",
  bank:
    "A separate business bank account for your debt-buying entity. Required for compliance + audit trail. Online-only banks are easiest.",
  "surety-bond":
    "Issues the surety bond your state license requires. Underwrites you personally — they want net-worth proof and a clean credit check.",
  insurance:
    "Errors & Omissions (E&O) insurance for your operations. Required by most servicers and lenders. Protects against claims of negligent practice.",
  attorney:
    "Specialized in consumer-finance law (FCRA, FDCPA, Reg F, state debt-buyer rules). Reviews your contracts, advises on compliance, defends class actions.",
  cpa:
    "Receivables-specialty accountant. Knows debt-portfolio accounting (mark-to-market, recovery accruals, charge-off vs put-back), tax structure for debt buyers.",
};

export const PROVIDERS: Provider[] = [
  // ── LLC FORMATION + EIN ────────────────────────────────────────────────
  {
    category: "ein-formation",
    name: "Northwest Registered Agent",
    url: "https://www.northwestregisteredagent.com/",
    costRange: "$39 + state fees",
    beginnerFriendly: true,
    notes:
      "Best-in-class for small operations. Forms your LLC, gets your EIN, includes registered-agent service for the first year. They actually answer the phone.",
  },
  {
    category: "ein-formation",
    name: "Stripe Atlas",
    url: "https://stripe.com/atlas",
    costRange: "$500 (one-time)",
    beginnerFriendly: true,
    notes:
      "Premium service if you also want a Mercury account, EIN, and a Stripe-issued debit card. Targeted at startups but works for any LLC.",
  },
  {
    category: "ein-formation",
    name: "ZenBusiness",
    url: "https://www.zenbusiness.com/",
    costRange: "$0–$300 + state fees",
    beginnerFriendly: true,
    notes:
      "Cheaper than Northwest but customer service is hit-or-miss. Free tier exists; pay for the $199 bundle for sane onboarding.",
  },
  {
    category: "ein-formation",
    name: "Self-file via state Secretary of State + IRS.gov",
    url: "https://www.irs.gov/businesses/employer-identification-number",
    costRange: "Free + state filing fees ($50–$300)",
    beginnerFriendly: false,
    notes:
      "DIY route. EIN is free at IRS.gov (10 minutes). LLC filing varies — Wyoming is $100, California is $70 + $800 annual franchise tax. Saves money but you're on your own for paperwork errors.",
  },

  // ── REGISTERED AGENT ──────────────────────────────────────────────────
  {
    category: "registered-agent",
    name: "Northwest Registered Agent",
    url: "https://www.northwestregisteredagent.com/",
    costRange: "$125/yr (or free first year if you formed with them)",
    beginnerFriendly: true,
    notes:
      "Same company as the LLC formation. Best privacy posture (their address, not yours, on the public state filings).",
  },
  {
    category: "registered-agent",
    name: "ZenBusiness Registered Agent",
    url: "https://www.zenbusiness.com/registered-agent-service/",
    costRange: "$199/yr",
    beginnerFriendly: true,
    notes: "Bundled with their LLC formation. Adequate.",
  },
  {
    category: "registered-agent",
    name: "Harbor Compliance",
    url: "https://www.harborcompliance.com/registered-agent-service",
    costRange: "$89–$200/yr per state",
    beginnerFriendly: false,
    notes:
      "Best if you'll be licensed in multiple states (each state needs a registered agent). Multi-state pricing structure.",
  },

  // ── BANK ──────────────────────────────────────────────────────────────
  {
    category: "bank",
    name: "Mercury",
    url: "https://mercury.com/",
    costRange: "Free",
    beginnerFriendly: true,
    notes:
      "Online-only business bank. No monthly fees. Wire transfers free. Onboarding is fully remote (10 minutes if you have your EIN). The default for new debt buyers.",
  },
  {
    category: "bank",
    name: "Relay",
    url: "https://relayfi.com/",
    costRange: "Free (with paid tiers $30+/mo for advanced features)",
    beginnerFriendly: true,
    notes:
      "Online bank with strong sub-account / 'envelope' features — useful for separating purchase capital from operating capital. Mercury's main competitor.",
  },
  {
    category: "bank",
    name: "Brex",
    url: "https://www.brex.com/",
    costRange: "Free for the bank account; cards have spend tiers",
    beginnerFriendly: false,
    notes:
      "Online business bank + corporate card. Better fit once you're operational; Mercury wins for first-year setup.",
  },
  {
    category: "bank",
    name: "Local community bank or credit union",
    url: "",
    costRange: "Varies; usually free or $10/mo with min balance",
    beginnerFriendly: false,
    notes:
      "If you need cash deposit / branch service. Slower onboarding but useful if you ever need a banker who will actually pick up the phone. Look for a community bank with a 'specialty deposit' relationship manager.",
  },

  // ── SURETY BOND ───────────────────────────────────────────────────────
  {
    category: "surety-bond",
    name: "Surety Bonds Direct",
    url: "https://www.suretybondsdirect.com/",
    costRange: "1–3% of bond amount annually (so $50–$1,500/yr on a $5k–$50k bond)",
    beginnerFriendly: true,
    notes:
      "Online quote in 5 minutes. Works with new applicants. Will run your credit and net-worth — expect a 1–3% premium if you have decent credit, higher if you don't.",
  },
  {
    category: "surety-bond",
    name: "JW Surety Bonds",
    url: "https://www.jwsuretybonds.com/",
    costRange: "1–4% of bond amount annually",
    beginnerFriendly: true,
    notes:
      "Strong for collection-agency and debt-buyer bonds specifically. Knows the regulatory regime in every state.",
  },
  {
    category: "surety-bond",
    name: "Old Republic Surety",
    url: "https://www.orsurety.com/",
    costRange: "1–2% with strong credit; up to 5% otherwise",
    beginnerFriendly: false,
    notes:
      "Industry incumbent — most agency producers can write Old Republic. Works through brokers, not direct.",
  },
  {
    category: "surety-bond",
    name: "Lance Surety Bonds",
    url: "https://www.lancesuretybonds.com/",
    costRange: "1–3% annually",
    beginnerFriendly: true,
    notes: "Online-friendly. Decent fit if Surety Bonds Direct declines you.",
  },

  // ── INSURANCE ─────────────────────────────────────────────────────────
  {
    category: "insurance",
    name: "Hiscox",
    url: "https://www.hiscox.com/",
    costRange: "$300–$1,500/yr for $1M E&O on a small operator",
    beginnerFriendly: true,
    notes:
      "Online quote, fast bind. Carries E&O for receivables operators — make sure you specify 'debt buyer / receivables management' on the application.",
  },
  {
    category: "insurance",
    name: "Embroker",
    url: "https://www.embroker.com/",
    costRange: "Varies by line; bundle pricing",
    beginnerFriendly: true,
    notes:
      "Online broker. Will quote E&O, GL, cyber, employment together. Useful once you have ~3 employees.",
  },
  {
    category: "insurance",
    name: "Crum & Forster — Specialty Lines",
    url: "https://www.cfins.com/",
    costRange: "Underwritten — depends on your operation",
    beginnerFriendly: false,
    notes:
      "Specialty E&O for receivables operators. Goes through brokers; relationship-driven. Industry standard for established operators.",
  },

  // ── ATTORNEY ──────────────────────────────────────────────────────────
  {
    category: "attorney",
    name: "Burr & Forman LLP — Consumer Financial Services",
    url: "https://www.burr.com/practice/consumer-financial-services",
    costRange: "$400–$700/hr; first consult often $300",
    beginnerFriendly: false,
    notes:
      "Major receivables-industry firm. Represents debt buyers in regulatory matters and class actions. RMAI-affiliated.",
  },
  {
    category: "attorney",
    name: "Hudson Cook LLP",
    url: "https://www.hudsoncook.com/",
    costRange: "$450–$800/hr",
    beginnerFriendly: false,
    notes: "Consumer-finance specialist. Strong in CFPB and state AG matters.",
  },
  {
    category: "attorney",
    name: "Maurice Wutscher LLP",
    url: "https://www.mauricewutscher.com/",
    costRange: "$350–$600/hr",
    beginnerFriendly: true,
    notes:
      "Receivables-defense specialist. Smaller firm, more accessible for new operators. Good first call for a compliance review.",
  },
  {
    category: "attorney",
    name: "RMAI member firm directory",
    url: "https://www.rmaintl.org/",
    costRange: "Varies",
    beginnerFriendly: true,
    notes:
      "RMAI (Receivables Management Association International) maintains a list of member law firms specializing in receivables. Free to browse; membership not required to call.",
  },

  // ── CPA ───────────────────────────────────────────────────────────────
  {
    category: "cpa",
    name: "Pisenti & Brinker LLP — Receivables Practice",
    url: "https://www.pbllp.com/",
    costRange: "$200–$400/hr; $3–8k for a typical year",
    beginnerFriendly: true,
    notes:
      "Specialty receivables CPA firm. Knows mark-to-market accounting for debt portfolios, tax treatment of recoveries, and ASC 326 (CECL) implications.",
  },
  {
    category: "cpa",
    name: "RMAI member CPA directory",
    url: "https://www.rmaintl.org/",
    costRange: "Varies",
    beginnerFriendly: true,
    notes: "Same RMAI directory; CPA members listed alongside law firms.",
  },
  {
    category: "cpa",
    name: "Local CPA with receivables experience",
    url: "",
    costRange: "$150–$300/hr",
    beginnerFriendly: true,
    notes:
      "Cheaper than specialty firms. Ask explicitly: 'Do you have other clients in receivables management or specialty finance?' If no, keep looking.",
  },
];

export function providersByCategory(): Record<ProviderCategory, Provider[]> {
  const out = Object.keys(CATEGORY_LABEL).reduce((acc, k) => {
    acc[k as ProviderCategory] = [];
    return acc;
  }, {} as Record<ProviderCategory, Provider[]>);
  for (const p of PROVIDERS) out[p.category].push(p);
  return out;
}

export const ORDER: ProviderCategory[] = [
  "ein-formation",
  "registered-agent",
  "bank",
  "surety-bond",
  "insurance",
  "attorney",
  "cpa",
];
