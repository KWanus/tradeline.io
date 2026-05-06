"use client";

import { useState } from "react";

type Strategy = {
  id: string;
  name: string;
  bucket: "core" | "growth" | "diversification" | "reserve" | "longterm";
  oneLine: string;
  pros: string[];
  cons: string[];
  expectedReturn: string;
  riskLevel: "low" | "medium" | "high";
};

const STRATEGIES: Strategy[] = [
  {
    id: "reinvest",
    name: "Compound back into more debt — same asset class",
    bucket: "core",
    oneLine: "Buy more of what you already underwrite well.",
    pros: [
      "Highest conviction — you already have a working model",
      "Same servicer, no new operational learning curve",
      "Compound on existing relationships with brokers",
    ],
    cons: [
      "Concentration risk in one asset class",
      "Diminishing returns above ~40% of monthly cash flow",
      "Correlated to consumer credit cycle",
    ],
    expectedReturn: "20–40% IRR (your existing model)",
    riskLevel: "medium",
  },
  {
    id: "hypothecate",
    name: "Hypothecate seasoned re-performing notes",
    bucket: "growth",
    oneLine:
      "Borrow against 12-24 month seasoned notes; redeploy borrowed dollars into new tapes.",
    pros: [
      "Leverage compounds returns on already-deployed capital",
      "Realizes the founder's original 'buy-perform-leverage' thesis",
      "30–60% advance rate on unsecured RPN; 50–75% on secured",
    ],
    cons: [
      "Adds debt service obligation regardless of collections",
      "Requires 12+ months of clean payment history per portfolio",
      "Margin-call risk in a downturn if collateral underperforms",
    ],
    expectedReturn: "Adds ~30–60% to per-deployed-dollar IRR (model-dependent)",
    riskLevel: "medium",
  },
  {
    id: "adjacent",
    name: "Adjacent asset class diversification",
    bucket: "diversification",
    oneLine:
      "Move from credit card → auto → junior mortgage → tax liens. Each step trades yield for collateral quality.",
    pros: [
      "Reduces concentration risk in one consumer-credit cycle",
      "Higher collateral quality opens better hypothecation terms",
      "Different recovery models = different downside scenarios",
    ],
    cons: [
      "New asset class = new underwriting model = months of relearning",
      "May need different servicer or new licensing",
      "Initial deals likely lower-IRR while learning",
    ],
    expectedReturn: "15–30% IRR depending on class chosen",
    riskLevel: "medium",
  },
  {
    id: "tax-liens",
    name: "Tax liens and judgment liens",
    bucket: "diversification",
    oneLine:
      "Statutory-interest-bearing liens with property as collateral; uncorrelated to consumer credit cycles.",
    pros: [
      "12–18% statutory interest in many states",
      "Property as collateral — much harder to lose principal",
      "Uncorrelated to consumer credit cycles",
    ],
    cons: [
      "State-by-state legal complexity",
      "Lower deal volume; harder to scale",
      "Different operational discipline (auctions, redemption periods)",
    ],
    expectedReturn: "12–18% statutory + property recovery upside",
    riskLevel: "low",
  },
  {
    id: "reo",
    name: "REO / foreclosure pipeline",
    bucket: "growth",
    oneLine:
      "When secured paper goes to foreclosure, take ownership of the property. Sell or rent.",
    pros: [
      "Buy a $150k face note for $40k, foreclose, sell house for $90k — real upside",
      "Forces returns on paper that wouldn't otherwise perform",
      "Equity build via property appreciation",
    ],
    cons: [
      "Real estate operations skill required",
      "Long workout times (12-24 months minimum)",
      "Property condition risk; eviction/legal costs",
    ],
    expectedReturn: "30–80% gross on individual properties; high variance",
    riskLevel: "high",
  },
  {
    id: "vertical",
    name: "Vertical integration — buy or invest in a servicer",
    bucket: "longterm",
    oneLine:
      "When you're sending $1M+/yr in fees to a servicer, the math says own them.",
    pros: [
      "Captures servicing margin (25–45% of collections)",
      "Operational visibility across all your portfolios",
      "Strategic moat — competitors can't replicate quickly",
    ],
    cons: [
      "Different licensing regime (FDCPA-heavy)",
      "People management, not just capital allocation",
      "Distraction from core buying operation",
    ],
    expectedReturn: "Servicing fees are 25–45% of collected dollars",
    riskLevel: "high",
  },
  {
    id: "tradeline-saas",
    name: "Reinvest in the SaaS arm (Tradeline)",
    bucket: "longterm",
    oneLine:
      "Every dollar reinvested in the SaaS compounds at SaaS multiples — higher than NPL operating multiples.",
    pros: [
      "SaaS revenue valued at 5–15x ARR vs 1–3x for operating debt-buyers",
      "Builds the Year-3 marketplace + benchmark moat",
      "Recurring revenue smooths NPL cash-flow lumpiness",
    ],
    cons: [
      "Slower to compound than direct debt purchases",
      "Requires hiring and product investment",
      "SaaS B2B sales cycle is 3–6 months",
    ],
    expectedReturn: "Ambiguous IRR; equity value compound is the prize",
    riskLevel: "medium",
  },
  {
    id: "treasury",
    name: "Conventional capital reserves",
    bucket: "reserve",
    oneLine:
      "T-bills, money market, short-duration treasuries. Boring. Required.",
    pros: [
      "When everyone is forced to sell at a discount, you're the one with cash",
      "6–12 months of operating expenses keeps you solvent in a downturn",
      "Currently ~4–5% yield on T-bills with zero credit risk",
    ],
    cons: [
      "Far below your operating IRR — opportunity cost is real",
      "Inflation-adjusted return is ~0–2%",
      "Easy to under-allocate when business is good",
    ],
    expectedReturn: "4–5% nominal (T-bills); ~0% real",
    riskLevel: "low",
  },
  {
    id: "fund",
    name: "Tradeline Capital — your own NPL fund (Year 4+)",
    bucket: "longterm",
    oneLine:
      "Family offices and PC funds want NPL exposure but don't want to operate. You operate; they fund.",
    pros: [
      "1.5–2% management fee + 15–20% carry on outside capital",
      "Scales returns far beyond your own balance sheet",
      "Long-end exit if SaaS doesn't IPO",
    ],
    cons: [
      "Fund formation legal costs ($150k+) and SEC compliance",
      "LP relationships add quarterly reporting burden",
      "Track record requirement: typically 3+ years of audited returns first",
    ],
    expectedReturn: "Carry on $25M+ AUM = $300k–600k/yr at 15% performance",
    riskLevel: "medium",
  },
];

const BUCKET_COPY: Record<Strategy["bucket"], { label: string; tone: string }> = {
  core: {
    label: "Core",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  },
  growth: {
    label: "Growth",
    tone: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  },
  diversification: {
    label: "Diversification",
    tone: "text-[color:var(--color-fg)] border-[color:var(--color-line-strong)]",
  },
  reserve: {
    label: "Reserve",
    tone: "text-[color:var(--color-fg-dim)] border-[color:var(--color-line)]",
  },
  longterm: {
    label: "Long-term / strategic",
    tone: "text-[color:var(--color-fg-dim)] border-[color:var(--color-line-strong)]",
  },
};

const RISK_TONE: Record<Strategy["riskLevel"], string> = {
  low: "text-[color:var(--color-accent)]",
  medium: "text-[color:var(--color-warn)]",
  high: "text-[color:var(--color-danger)]",
};

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

type Allocation = Record<string, number>;

function suggestAllocation({
  cashOnHand,
  monthlyOpex,
  monthlyCashFlow,
}: {
  cashOnHand: number;
  monthlyOpex: number;
  monthlyCashFlow: number;
}): { allocation: Allocation; explanation: string[] } {
  const explanation: string[] = [];
  const monthsOfRunway = monthlyOpex > 0 ? cashOnHand / monthlyOpex : 99;

  // Stage 1 — under 6 months of runway = put it all in T-bills until safe
  if (monthsOfRunway < 6) {
    explanation.push(
      `Cash covers ~${monthsOfRunway.toFixed(1)} months of opex — below the 6-month floor. The first allocation should rebuild reserve, not chase returns.`
    );
    return {
      allocation: {
        treasury: 70,
        reinvest: 20,
        "tradeline-saas": 10,
      },
      explanation,
    };
  }

  // Stage 2 — 6 to 12 months runway = mostly reinvest, keep building reserve
  if (monthsOfRunway < 12) {
    explanation.push(
      `Cash covers ${monthsOfRunway.toFixed(0)} months of opex — adequate. Allocate aggressively into the operating model while keeping reserve trending up.`
    );
    return {
      allocation: {
        reinvest: 40,
        treasury: 25,
        adjacent: 15,
        hypothecate: 10,
        "tradeline-saas": 10,
      },
      explanation,
    };
  }

  // Stage 3 — 12+ months runway = full diversified allocation
  explanation.push(
    `${monthsOfRunway.toFixed(0)} months of runway is comfortable. Now optimize for compounding rate, not just safety.`
  );

  if (monthlyCashFlow >= 50_000) {
    explanation.push(
      "Cash flow above $50k/mo justifies starting an adjacent-class pilot and a fund-prep track."
    );
    return {
      allocation: {
        reinvest: 30,
        hypothecate: 20,
        adjacent: 15,
        treasury: 15,
        "tradeline-saas": 10,
        "tax-liens": 5,
        vertical: 5,
      },
      explanation,
    };
  }

  return {
    allocation: {
      reinvest: 35,
      hypothecate: 20,
      adjacent: 15,
      treasury: 15,
      "tradeline-saas": 15,
    },
    explanation,
  };
}

export function CapitalAllocationCalculator() {
  const [cashOnHand, setCashOnHand] = useState(150_000);
  const [monthlyOpex, setMonthlyOpex] = useState(8_000);
  const [monthlyCashFlow, setMonthlyCashFlow] = useState(15_000);

  const { allocation, explanation } = suggestAllocation({
    cashOnHand,
    monthlyOpex,
    monthlyCashFlow,
  });
  const monthsOfRunway = monthlyOpex > 0 ? cashOnHand / monthlyOpex : 99;
  const annualCashFlow = monthlyCashFlow * 12;

  return (
    <div className="space-y-10">
      <section>
        <SectionLabel>Step 1 · Where you stand today</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
          <Slider
            label="Cash on hand"
            value={cashOnHand}
            min={0}
            max={5_000_000}
            step={5_000}
            format={formatUSD}
            onChange={setCashOnHand}
          />
          <Slider
            label="Monthly opex"
            value={monthlyOpex}
            min={0}
            max={100_000}
            step={500}
            format={formatUSD}
            onChange={setMonthlyOpex}
          />
          <Slider
            label="Monthly NPL cash flow"
            value={monthlyCashFlow}
            min={0}
            max={500_000}
            step={500}
            format={formatUSD}
            onChange={setMonthlyCashFlow}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
          <Stat
            label="Months of runway"
            value={monthsOfRunway > 99 ? "99+" : monthsOfRunway.toFixed(1)}
            tone={
              monthsOfRunway < 6
                ? "warn"
                : monthsOfRunway < 12
                ? "default"
                : "ok"
            }
          />
          <Stat label="Annual cash flow" value={formatUSD(annualCashFlow)} />
          <Stat
            label="Stage"
            value={
              monthsOfRunway < 6
                ? "Defensive"
                : monthsOfRunway < 12
                ? "Building"
                : "Compounding"
            }
            tone={
              monthsOfRunway < 6
                ? "warn"
                : monthsOfRunway < 12
                ? "default"
                : "ok"
            }
          />
        </div>
      </section>

      <section>
        <SectionLabel>Step 2 · Suggested allocation</SectionLabel>
        <p className="mt-2 mb-4 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Based on your current cash and runway. This is a starting heuristic, not
          financial advice — adjust to your risk tolerance, market conditions, and
          your operational headroom.
        </p>
        {explanation.map((e, i) => (
          <p
            key={i}
            className="mb-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed border-l-2 border-[color:var(--color-line-strong)] pl-4"
          >
            {e}
          </p>
        ))}
        <div className="mt-5 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]">
          {Object.entries(allocation)
            .sort((a, b) => b[1] - a[1])
            .map(([id, pct]) => {
              const s = STRATEGIES.find((x) => x.id === id);
              if (!s) return null;
              const dollars = (cashOnHand * pct) / 100;
              return (
                <div
                  key={id}
                  className="flex items-baseline gap-4 px-5 py-4 border-b border-[color:var(--color-line)] last:border-b-0"
                >
                  <div className="font-mono text-2xl text-[color:var(--color-accent)] tick w-16">
                    {pct}%
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] text-[color:var(--color-fg)] font-medium">
                      {s.name}
                    </div>
                    <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)]">
                      {s.oneLine}
                    </div>
                  </div>
                  <div className="font-mono text-[14px] text-[color:var(--color-fg)] tick">
                    {formatUSD(dollars)}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      <section>
        <SectionLabel>All nine strategies — pros, cons, returns</SectionLabel>
        <p className="mt-2 mb-4 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          The full menu of capital-allocation moves a licensed NPL operator can
          make. Read top-to-bottom; reference when allocating.
        </p>
        <div className="space-y-3">
          {STRATEGIES.map((s) => (
            <article
              key={s.id}
              className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6"
            >
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-medium text-[color:var(--color-fg)]">
                    {s.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 border ${BUCKET_COPY[s.bucket].tone}`}
                    >
                      {BUCKET_COPY[s.bucket].label}
                    </span>
                    <span
                      className={`font-mono text-[10px] tracking-[0.2em] uppercase ${RISK_TONE[s.riskLevel]}`}
                    >
                      Risk: {s.riskLevel}
                    </span>
                  </div>
                </div>
                <div className="text-right max-w-[40%]">
                  <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                    Expected return
                  </div>
                  <div className="mt-1 text-[13px] text-[color:var(--color-fg)]">
                    {s.expectedReturn}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {s.oneLine}
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-accent)] uppercase">
                    Pros
                  </div>
                  <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {s.pros.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-warn)] uppercase">
                    Cons
                  </div>
                  <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {s.cons.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          What disciplined operators avoid
        </div>
        <ul className="mt-3 space-y-1 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          <li>Crypto, options, individual stocks — uncorrelated risk on top of correlated risk</li>
          <li>Levering up on unsecured RPN at &gt;50% LTV — margin-called in the next downturn</li>
          <li>Buying paper outside your servicer&rsquo;s strike zone</li>
          <li>Geographic concentration in one state or one originator</li>
          <li>Skipping reserve allocation when business is good — it&rsquo;s how operators wash out</li>
        </ul>
      </section>

      <p className="text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Educational tooling. Not investment advice. Run any allocation by your
        accountant and consumer-finance counsel before deploying capital.
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          {label}
        </div>
        <div className="font-mono text-[15px] text-[color:var(--color-accent)] tick">
          {format(value)}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[color:var(--color-accent)]"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "default";
}) {
  const color =
    tone === "warn"
      ? "text-[color:var(--color-warn)]"
      : tone === "ok"
      ? "text-[color:var(--color-accent)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
    </div>
  );
}
