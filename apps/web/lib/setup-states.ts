// Per-state setup playbook. Focused on the four mid-Atlantic states the
// founder is choosing among (VA / MD / NC / GA), with cost & timeline ranges.
// Numbers are public information as of 2026-05-06; verify with state regulator
// before filing.

export type StatePlaybook = {
  state: string;
  name: string;
  difficulty: "easy" | "moderate" | "strict";
  buyerLicenseRequired: boolean;
  collectionLicenseRequired: boolean;
  bondAmountUsd: number;
  filingFeeUsd: number;
  annualRenewalFeeUsd: number;
  typicalTimelineDays: string;
  regulatorName: string;
  regulatorUrl: string;
  applicationUrl: string;
  beginnerNotes: string;
  redFlags: string[];
  steps: string[];
};

export const STATES: StatePlaybook[] = [
  {
    state: "GA",
    name: "Georgia",
    difficulty: "easy",
    buyerLicenseRequired: false,
    collectionLicenseRequired: true,
    bondAmountUsd: 0,
    filingFeeUsd: 100,
    annualRenewalFeeUsd: 100,
    typicalTimelineDays: "30–45 days",
    regulatorName: "Georgia Secretary of State (collection-agency aspects)",
    regulatorUrl: "https://sos.ga.gov/",
    applicationUrl: "https://sos.ga.gov/index.php/Corporations",
    beginnerNotes:
      "Easiest entry state. Georgia does NOT require a separate debt-buyer license. If you use a third-party servicer (which most new buyers should), you don't need a collection-agency license either — your servicer holds the licenses for the states they collect in.",
    redFlags: [
      "If you self-collect (don't use a servicer), GA collection-agency requirements apply",
      "Some GA counties have post-judgment collection nuances; verify with attorney before suing",
    ],
    steps: [
      "Form your LLC in Georgia (or in Wyoming/Delaware and register as foreign LLC in GA)",
      "Get EIN from IRS.gov (free, instant)",
      "Open business bank account (Mercury or Relay — fully remote)",
      "Sign master servicing agreement with a licensed servicer (NCB Management, Resurgent, JH Portfolio)",
      "Optional: Get E&O insurance ($300–$1,500/yr from Hiscox)",
      "Optional: Establish CPA + attorney relationships",
      "You can begin evaluating broker tapes",
    ],
  },
  {
    state: "VA",
    name: "Virginia",
    difficulty: "moderate",
    buyerLicenseRequired: false,
    collectionLicenseRequired: true,
    bondAmountUsd: 5_000,
    filingFeeUsd: 250,
    annualRenewalFeeUsd: 250,
    typicalTimelineDays: "60–90 days",
    regulatorName: "Virginia State Corporation Commission, Bureau of Financial Institutions",
    regulatorUrl: "https://scc.virginia.gov/pages/Bureau-Financial-Institutions",
    applicationUrl: "https://scc.virginia.gov/pages/CDO-Forms",
    beginnerNotes:
      "Virginia has no debt-buyer-specific license. Collection-agency license required IF you self-collect. Most new buyers route through a third-party servicer (NCB Management, Resurgent) and skip the VA license entirely. The servicer holds the VA license; you're just the buyer.",
    redFlags: [
      "Virginia has fingerprint requirement for collection-agency owners (skip this by using third-party servicer)",
      "Virginia AG actively enforces FDCPA — strict on validation notices",
      "Cannot collect on out-of-statute debt (3-year SOL on credit card)",
    ],
    steps: [
      "Form Virginia LLC OR register a Wyoming/Delaware LLC as foreign in VA",
      "Get EIN from IRS.gov",
      "Open business bank account (Mercury / Relay)",
      "Sign master servicing agreement with VA-licensed servicer",
      "Get E&O insurance (Virginia is a strict state — make sure your servicer is rock-solid)",
      "Optional: Get VA collection-agency license ($250 + $5k bond, 60-90 days) IF you ever want to self-collect",
    ],
  },
  {
    state: "NC",
    name: "North Carolina",
    difficulty: "moderate",
    buyerLicenseRequired: false,
    collectionLicenseRequired: true,
    bondAmountUsd: 10_000,
    filingFeeUsd: 500,
    annualRenewalFeeUsd: 250,
    typicalTimelineDays: "60–120 days",
    regulatorName: "North Carolina Department of Insurance",
    regulatorUrl: "https://www.ncdoi.gov/",
    applicationUrl: "https://www.ncdoi.gov/insurance-industry/agencies-agents-adjusters/collection-agency",
    beginnerNotes:
      "Similar to Virginia — no separate buyer license, collection-agency license required if self-collecting. Most new buyers use a third-party servicer with NC license. Bond is higher than VA ($10k vs $5k).",
    redFlags: [
      "NC SOL on credit card debt is only 3 years — very buyer-unfriendly",
      "Strict on validation notices; class actions are common",
      "Long licensing timeline (up to 120 days) if you do self-license",
    ],
    steps: [
      "Form NC LLC OR foreign-register your existing LLC in NC",
      "Get EIN",
      "Open business bank account",
      "Sign master servicing agreement with NC-licensed servicer",
      "Get E&O insurance",
      "Optional: NC collection-agency license ($500 + $10k bond, 60-120 days)",
    ],
  },
  {
    state: "MD",
    name: "Maryland",
    difficulty: "strict",
    buyerLicenseRequired: true,
    collectionLicenseRequired: true,
    bondAmountUsd: 5_000,
    filingFeeUsd: 700,
    annualRenewalFeeUsd: 700,
    typicalTimelineDays: "90–180 days",
    regulatorName: "Maryland Office of the Commissioner of Financial Regulation",
    regulatorUrl: "https://www.dllr.state.md.us/finance/",
    applicationUrl: "https://www.dllr.state.md.us/finance/industry/coall.shtml",
    beginnerNotes:
      "Maryland is one of the strictest debt-buyer regulatory regimes in the US. Separate debt-buyer license REQUIRED, plus collection-agency license. $5k bond. Slow approval. Active AG enforcement. Strongly recommended to NOT start in Maryland — pick GA or VA, and add Maryland later when you have a track record.",
    redFlags: [
      "Maryland AG is highly active — class actions common",
      "Medical-debt-specific rules (2024+) require additional disclosures",
      "Cannot rely on signed contracts to extend SOL (signed-contract revival doctrine doesn't apply)",
      "Slow regulator response time (90-180 days)",
    ],
    steps: [
      "Form LLC (preferably Maryland-resident; MD scrutinizes out-of-state operators)",
      "Get EIN",
      "Open MD business bank account",
      "Apply for MD debt-buyer license + collection-agency license (file together)",
      "Post $5,000 surety bond",
      "Get E&O insurance ($500k+ minimum coverage required)",
      "Provide fingerprints + background check",
      "Wait 90-180 days for approval",
      "Sign master servicing agreement with MD-licensed servicer",
    ],
  },
];

export const STATE_OVERVIEW = {
  recommended_starting_state: "GA",
  recommendation_reason:
    "Georgia is the cheapest, fastest, and most beginner-friendly entry state. No buyer license required. If you use a third-party servicer (recommended), no collection license needed either. You can be operational in ~30 days for under $1,000 of upfront cost.",
};
