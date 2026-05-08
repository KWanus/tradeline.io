// Marketplace subscribers — supply-side customers (brokers, lenders, attorneys,
// CPAs, fund-of-funds) who pay Tradeline for filtered deal-flow alerts.
//
// Distinct from /app/customers (the buy-side SaaS customers using the radar).
// Same underlying data, different product, different pricing, different sales
// motion.

export type SubscriberType =
  | "broker"
  | "lender"
  | "attorney"
  | "cpa"
  | "fund-of-funds"
  | "specialty-finance"
  | "originator-bank";

export type SubscriberPlan =
  | "trial"
  | "starter"
  | "pro"
  | "enterprise"
  | "fund-of-funds";

export type DeliveryChannel = "email" | "slack" | "webhook";

export type AlertPreferences = {
  tickers: string[];           // empty = all tracked banks
  signalTypes: string[];       // empty = all signal types
  assetClasses: string[];      // empty = all asset classes
  minConfidence: number;       // 0-1; default 0.5
  deliveryChannel: DeliveryChannel;
  deliveryAddress: string;
};

export type Subscriber = {
  id: string;
  orgName: string;
  contactName: string;
  contactEmail: string;
  type: SubscriberType;
  plan: SubscriberPlan;
  mrrUsd: number;
  startDate: string;
  preferences: AlertPreferences;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const SUBSCRIBER_TYPE_LABEL: Record<SubscriberType, string> = {
  broker: "Broker / auction platform",
  lender: "Hypothecation lender",
  attorney: "Consumer-finance attorney",
  cpa: "Receivables-specialty CPA",
  "fund-of-funds": "Fund-of-funds / institutional",
  "specialty-finance": "Specialty finance / advisory",
  "originator-bank": "Bank corporate development",
};

export const SUBSCRIBER_TYPE_BUYS: Record<SubscriberType, string> = {
  broker:
    "Pre-position buyer panels: which mid-tier regionals are 1-2 quarters from divesting in their asset class?",
  lender:
    "Buyer-pipeline intelligence: which licensed buyers will cross 12-month seasoning thresholds in the next 6 months?",
  attorney:
    "Compliance + enforcement: which buyers are growing fast (potential clients), which states are tightening rules, which CFPB orders just landed.",
  cpa:
    "Target-client signal: which buyers are crossing $5M face under management — the inflection where they need specialty receivables CPA.",
  "fund-of-funds":
    "Manager pipeline: which active operators are 12-24 months from being fund-raisable — first call before they go to placement agents.",
  "specialty-finance":
    "Cross-sell signal: which buyers are likely to need new servicers, new credit lines, new insurance — your sales pipeline.",
  "originator-bank":
    "Market intelligence: how much paper is moving in your peer banks, what prices are clearing, when to time your own divestiture.",
};

export const PLAN_DETAILS: Record<
  SubscriberPlan,
  { label: string; mrrUsd: number; description: string; features: string[] }
> = {
  trial: {
    label: "Trial",
    mrrUsd: 0,
    description: "14-day evaluation. 5 alerts max. No credit card.",
    features: [
      "Up to 5 alerts during trial",
      "Single user",
      "All originators visible",
      "Email delivery only",
    ],
  },
  starter: {
    label: "Starter",
    mrrUsd: 499,
    description: "For boutique brokers and small specialty firms.",
    features: [
      "Alerts on up to 10 originators",
      "Single user",
      "Email or Slack delivery",
      "Standard signal types (charge-offs, NPL, divestitures)",
      "Monthly market summary",
    ],
  },
  pro: {
    label: "Pro",
    mrrUsd: 1499,
    description: "For active brokers, mid-tier lenders, busy advisors.",
    features: [
      "Unlimited originators",
      "Up to 5 users",
      "Custom asset-class focus",
      "Custom signal thresholds",
      "Slack + email + webhook delivery",
      "Quarterly market deep-dive",
      "30-min onboarding call",
    ],
  },
  enterprise: {
    label: "Enterprise",
    mrrUsd: 4999,
    description: "For institutional buyers, multi-strategy funds, large banks.",
    features: [
      "Everything in Pro",
      "Unlimited users + white-labeled portal",
      "Custom signal definitions",
      "Direct API access",
      "Dedicated account manager",
      "Quarterly executive briefings",
      "Custom research add-ons",
    ],
  },
  "fund-of-funds": {
    label: "Fund of Funds",
    mrrUsd: 9999,
    description:
      "For fund-of-funds, institutional LPs, and capital-markets desks. Tier added per pricing benchmark vs Curinos / Argus ($50k+/yr) — see /app/intel.",
    features: [
      "Everything in Enterprise",
      "Multi-fund consolidated view",
      "Manager-pipeline intelligence (which operators near fund-raisable)",
      "Cross-strategy vintage diversification reporting",
      "Direct partner-company access (white-glove research)",
      "Quarterly investment-committee briefings",
      "Annual market-trend whitepaper (co-branded option)",
    ],
  },
};

export const PLANS_ORDERED: SubscriberPlan[] = [
  "trial",
  "starter",
  "pro",
  "enterprise",
  "fund-of-funds",
];

export const SIGNAL_TYPE_OPTIONS = [
  "charge_off_increase",
  "npl_ratio_increase",
  "reserve_build",
  "portfolio_sale_announced",
  "divestiture_announced",
  "guidance_change",
  "unspecified",
];

export const SIGNAL_TYPE_LABEL: Record<string, string> = {
  charge_off_increase: "Charge-offs accelerating",
  npl_ratio_increase: "Non-performing loans rising",
  reserve_build: "Reserve build (provisioning)",
  portfolio_sale_announced: "Portfolio sale announced",
  divestiture_announced: "Divestiture event",
  guidance_change: "Outlook / guidance change",
  unspecified: "Quarterly review window",
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

// ─── Storage helpers ────────────────────────────────────────────────────

export const STORAGE_KEY = "tradeline.subscribers.v1";
export const ALERT_LOG_STORAGE_KEY = "tradeline.alert_log.v1";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadFromStorage(): Subscriber[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Subscriber[]) : [];
  } catch {
    return [];
  }
}

export function saveToStorage(subscribers: Subscriber[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
}

// ─── Alert log ──────────────────────────────────────────────────────────

export type AlertLogEntry = {
  id: string;
  subscriberId: string;
  subscriberOrg: string;
  recipientAddress: string;
  channel: DeliveryChannel;
  subject: string;
  signalSourceId: string;
  signalTicker: string;
  signalType: string;
  confidence: number;
  status: "sent" | "preview" | "failed";
  failureReason?: string;
  sentAt: string;
};

export function loadAlertLog(): AlertLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlertLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveAlertLog(log: AlertLogEntry[]): void {
  if (typeof window === "undefined") return;
  // Cap log at 500 entries to keep localStorage manageable
  const capped = log.slice(-500);
  window.localStorage.setItem(ALERT_LOG_STORAGE_KEY, JSON.stringify(capped));
}

export const DEMO_SUBSCRIBERS: Omit<Subscriber, "id" | "createdAt" | "updatedAt">[] = [
  {
    orgName: "Garnet Capital Advisors",
    contactName: "L. Sterling",
    contactEmail: "alerts@garnetcapital.example",
    type: "broker",
    plan: "pro",
    mrrUsd: 1499,
    startDate: "2026-02-15",
    preferences: {
      tickers: ["FITB", "HBAN", "WAL", "EWBC", "FLG"],
      signalTypes: ["portfolio_sale_announced", "divestiture_announced", "charge_off_increase"],
      assetClasses: ["Credit card", "Commercial"],
      minConfidence: 0.6,
      deliveryChannel: "email",
      deliveryAddress: "alerts@garnetcapital.example",
    },
    notes:
      "Senior origination team subscribes for buyer-panel pre-positioning. 90% of value is the 8-K item 2.01 alerts.",
  },
  {
    orgName: "Webster Bank — Specialty Lending",
    contactName: "M. Park",
    contactEmail: "m.park@webster.example",
    type: "lender",
    plan: "enterprise",
    mrrUsd: 4999,
    startDate: "2026-01-08",
    preferences: {
      tickers: [],
      signalTypes: ["charge_off_increase", "reserve_build"],
      assetClasses: ["Junior mortgage", "Auto"],
      minConfidence: 0.7,
      deliveryChannel: "webhook",
      deliveryAddress: "https://webster.example/webhooks/tradeline",
    },
    notes:
      "Pulls into their internal CRM via webhook. Asked for custom signal: 'buyer maturing past 12-month seasoning' — promised in Pro+ tier add-on.",
  },
  {
    orgName: "Maurice Wutscher LLP",
    contactName: "T. Reyes",
    contactEmail: "treyes@mauricewutscher.example",
    type: "attorney",
    plan: "starter",
    mrrUsd: 499,
    startDate: "2026-03-22",
    preferences: {
      tickers: ["COF", "DFS", "SYF", "ALLY"],
      signalTypes: ["divestiture_announced", "guidance_change"],
      assetClasses: [],
      minConfidence: 0.5,
      deliveryChannel: "email",
      deliveryAddress: "treyes@mauricewutscher.example",
    },
    notes:
      "Mid-firm; subscribes for compliance-conversation triggers. Often forwards to associates as case-development context.",
  },
];
