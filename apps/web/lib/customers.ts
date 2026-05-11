// Buy-side customers — licensed debt buyers, collection agencies, and debt
// brokers paying for the radar / pipeline / portfolio side of Tradeline.
//
// Distinct from /app/subscribers (the supply-side: brokers, lenders,
// attorneys, CPAs paying for filtered deal-flow alerts). Same operator,
// different revenue line.

export type CustomerPlan = "trial" | "solo" | "pro" | "team" | "enterprise";

export type CustomerStatus = "trial" | "active" | "paused" | "churned";

export type BuyCustomer = {
  id: string;
  orgName: string;
  contactName: string;
  contactEmail: string;
  plan: CustomerPlan;
  status: CustomerStatus;
  mrrUsd: number;
  startDate: string;
  licensedStates: string[];     // 2-letter codes
  assetClassFocus: string[];
  designPartner: boolean;
  affiliateReferrer: string;
  lastActivityAt: string;       // ISO date — last login or radar view
  // Usage signals — manual entry for Phase 1, automated in Phase 2.5
  radarVisitsLastWeek: number;
  mcpToolCallsLastWeek: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const CUSTOMER_PLANS_ORDERED: CustomerPlan[] = [
  "trial",
  "solo",
  "pro",
  "team",
  "enterprise",
];

export const CUSTOMER_PLAN_DETAILS: Record<
  CustomerPlan,
  { label: string; mrrUsd: number; description: string; features: string[] }
> = {
  trial: {
    label: "Trial",
    mrrUsd: 0,
    description: "14-day evaluation. Full radar access. No credit card.",
    features: [
      "Full radar access",
      "Single user",
      "MCP server access",
      "Email-only support",
    ],
  },
  solo: {
    label: "Solo",
    mrrUsd: 99,
    description: "For solo licensed buyers and small operators.",
    features: [
      "Full radar + 2 portfolio scores/mo",
      "Single user",
      "Email digest",
      "Basic compliance tracker",
    ],
  },
  pro: {
    label: "Pro",
    mrrUsd: 299,
    description: "For active buyers running 5–20 deals a month.",
    features: [
      "Unlimited radar + 10 portfolio scores/mo",
      "Up to 3 users",
      "MCP server access",
      "Tape evaluation copilot",
      "Pipeline + Portfolio operations",
    ],
  },
  team: {
    label: "Team",
    mrrUsd: 899,
    description: "For mid-tier buyers with operations teams.",
    features: [
      "Everything in Pro",
      "Up to 5 users",
      "Custom signal definitions (Phase 2.5)",
      "$1k research credit/mo",
      "Priority support",
    ],
  },
  enterprise: {
    label: "Enterprise",
    mrrUsd: 2999,
    description: "Custom $2k–$5k+/mo for institutional buyers.",
    features: [
      "Everything in Team",
      "Unlimited users",
      "White-labeled MCP",
      "Direct API access",
      "Dedicated success manager",
      "Quarterly strategic briefings",
    ],
  },
};

export const STATUS_TONE: Record<CustomerStatus, string> = {
  trial: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  active: "text-[color:var(--color-success)] border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]",
  paused: "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]",
  churned: "text-[color:var(--color-danger)] border-[color:var(--color-danger)]",
};

export const ASSET_CLASS_OPTIONS = [
  "Credit card",
  "Auto",
  "Junior mortgage",
  "Medical",
  "Commercial",
  "Tax lien",
  "Specialty",
];

// Risk thresholds for "at-risk" customer identification.
// A customer is at-risk if they haven't logged in for 14+ days AND have
// a paid plan, OR if their last-week radar visits dropped to 0.
export function riskLevel(c: BuyCustomer): "ok" | "watch" | "at-risk" {
  if (c.status !== "active" && c.status !== "trial") return "ok";
  const lastActivity = new Date(c.lastActivityAt || c.startDate).getTime();
  const daysSince = Math.floor(
    (Date.now() - lastActivity) / (1000 * 60 * 60 * 24)
  );
  if (daysSince >= 14) return "at-risk";
  if (c.radarVisitsLastWeek === 0 && c.mrrUsd > 0) return "at-risk";
  if (daysSince >= 7) return "watch";
  if (c.radarVisitsLastWeek <= 1 && c.mrrUsd >= 299) return "watch";
  return "ok";
}

export const RISK_TONE = {
  ok: "text-[color:var(--color-accent)]",
  watch: "text-[color:var(--color-warn)]",
  "at-risk": "text-[color:var(--color-danger)]",
};

// ─── Storage ────────────────────────────────────────────────────────────

export const STORAGE_KEY = "tradeline.customers.v1";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadFromStorage(): BuyCustomer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BuyCustomer[]) : [];
  } catch {
    return [];
  }
}

export function saveToStorage(customers: BuyCustomer[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

export const DEMO_CUSTOMERS: Omit<
  BuyCustomer,
  "id" | "createdAt" | "updatedAt"
>[] = [
  {
    orgName: "Mid-Atlantic Receivables LLC",
    contactName: "K. Thompson",
    contactEmail: "k.thompson@example.com",
    plan: "pro",
    status: "active",
    mrrUsd: 299,
    startDate: "2026-02-01",
    licensedStates: ["VA", "MD", "NC", "GA"],
    assetClassFocus: ["Credit card", "Medical"],
    designPartner: true,
    affiliateReferrer: "",
    lastActivityAt: "2026-05-06",
    radarVisitsLastWeek: 12,
    mcpToolCallsLastWeek: 28,
    notes:
      "First design partner. Heavy MCP usage — they run a Claude Desktop workflow daily. Flagged in early conversations as likely Team-tier expansion at month 6.",
  },
  {
    orgName: "Atlantic Buyer Group",
    contactName: "J. Park",
    contactEmail: "j.park@example.com",
    plan: "team",
    status: "active",
    mrrUsd: 899,
    startDate: "2026-01-15",
    licensedStates: ["NY", "NJ", "PA", "MA", "CT"],
    assetClassFocus: ["Credit card", "Auto"],
    designPartner: false,
    affiliateReferrer: "Garnet Capital",
    lastActivityAt: "2026-05-05",
    radarVisitsLastWeek: 25,
    mcpToolCallsLastWeek: 67,
    notes:
      "Team of 4 underwriters; they use Pipeline + Portfolio heavily. Affiliate referral from Garnet — pays 10% recurring. Asked for white-label tape copilot — promising for Enterprise upgrade.",
  },
  {
    orgName: "Sierra Receivables",
    contactName: "P. Mendez",
    contactEmail: "p.mendez@example.com",
    plan: "solo",
    status: "active",
    mrrUsd: 99,
    startDate: "2026-04-12",
    licensedStates: ["CA", "NV", "AZ"],
    assetClassFocus: ["Auto", "Junior mortgage"],
    designPartner: false,
    affiliateReferrer: "",
    lastActivityAt: "2026-05-06",
    radarVisitsLastWeek: 8,
    mcpToolCallsLastWeek: 0,
    notes:
      "Solo operator; west-coast secured paper specialist. Doesn't use MCP. Low risk of churn — uses tape copilot weekly.",
  },
  {
    orgName: "Cardinal Capital LLC",
    contactName: "S. Rao",
    contactEmail: "s.rao@example.com",
    plan: "pro",
    status: "trial",
    mrrUsd: 0,
    startDate: "2026-04-28",
    licensedStates: ["TX"],
    assetClassFocus: ["Credit card"],
    designPartner: false,
    affiliateReferrer: "",
    lastActivityAt: "2026-05-04",
    radarVisitsLastWeek: 4,
    mcpToolCallsLastWeek: 0,
    notes:
      "Trial day 9 of 14. Used radar + tape copilot once. Hasn't tried MCP — schedule onboarding call to convert before trial expires.",
  },
  {
    orgName: "Highland NPL Partners",
    contactName: "D. Burke",
    contactEmail: "d.burke@example.com",
    plan: "pro",
    status: "active",
    mrrUsd: 299,
    startDate: "2026-03-10",
    licensedStates: ["FL", "GA"],
    assetClassFocus: ["Commercial", "Specialty"],
    designPartner: false,
    affiliateReferrer: "",
    lastActivityAt: "2026-04-19",
    radarVisitsLastWeek: 0,
    mcpToolCallsLastWeek: 0,
    notes:
      "AT-RISK — 18 days since last login, zero usage last week. Reached out via email 5 days ago, no response. Schedule recovery call.",
  },
];
