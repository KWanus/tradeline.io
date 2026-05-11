"use client";

import Link from "next/link";
import { ProgressBar, StepCheckbox, usePathProgress } from "./_progress";

type Step = {
  id: string;
  title: string;
  rec: string;            // the recommendation in 6 words or less
  rationale: string;      // one sentence
  what: string;           // exactly what to do
  doneBy: "you" | "tradeline" | "partner";
  costUsd: number;        // 0 means free
  minutes: number;        // estimated time
  cta: { label: string; href: string; external?: boolean };
};

type Stage = {
  id: string;
  number: string;
  duration: string;
  name: string;
  emoji: string;
  totalCost: number;
  goal: string;
  steps: Step[];
};

const STAGES: Stage[] = [
  {
    id: "foundation",
    number: "01",
    duration: "Month 1",
    name: "Foundation",
    emoji: "⌂",
    totalCost: 1200,
    goal: "Legal entity, bank account, license-free state — operational in 30 days for under $1,500.",
    steps: [
      {
        id: "1.1",
        title: "Form an LLC in Georgia",
        rec: "Georgia",
        rationale: "GA does not require a separate debt-buyer license, so you can be operational fast if you route through a licensed third-party servicer.",
        what: "Go to Northwest Registered Agent and form a Georgia LLC. Costs $100 GA filing fee + $200 Northwest service.",
        doneBy: "you",
        costUsd: 300,
        minutes: 20,
        cta: { label: "Open Northwest", href: "https://www.northwestregisteredagent.com/", external: true },
      },
      {
        id: "1.2",
        title: "Get your EIN",
        rec: "irs.gov, free, 10 minutes",
        rationale: "EIN is your federal tax ID. Required for everything that follows.",
        what: "Visit irs.gov/ein and complete the SS-4 online application. Issued instantly.",
        doneBy: "you",
        costUsd: 0,
        minutes: 10,
        cta: { label: "Apply for EIN", href: "https://www.irs.gov/businesses/employer-identification-number", external: true },
      },
      {
        id: "1.3",
        title: "Open a Mercury business account",
        rec: "Mercury",
        rationale: "Mercury is free, fully remote, friendly to debt-buyer LLCs, and the de-facto standard for small operators.",
        what: "Apply at mercury.com using your EIN and LLC formation documents. Approval usually under 48 hours.",
        doneBy: "you",
        costUsd: 0,
        minutes: 30,
        cta: { label: "Open Mercury", href: "https://mercury.com/", external: true },
      },
      {
        id: "1.4",
        title: "Sign master servicing agreement with NCB Management",
        rec: "NCB Management",
        rationale: "NCB is the most-used servicer for new buyers, has compliance infrastructure, and works with small portfolios.",
        what: "Contact NCB Management to begin servicer onboarding. Tradeline drafts the introduction email for you.",
        doneBy: "you",
        costUsd: 0,
        minutes: 60,
        cta: { label: "See servicers", href: "/app/servicers" },
      },
      {
        id: "1.5",
        title: "Bind E&O insurance with Hiscox",
        rec: "Hiscox $1M E&O",
        rationale: "Hiscox quotes online in minutes; $1M coverage with receivables-management endorsement runs ~$500-$1,500/yr.",
        what: "Get a quote at hiscox.com. Specify 'debt buyer / receivables management' on the application.",
        doneBy: "you",
        costUsd: 750,
        minutes: 25,
        cta: { label: "Get Hiscox quote", href: "https://www.hiscox.com/", external: true },
      },
      {
        id: "1.6",
        title: "Engage Maurice Wutscher for the first compliance review",
        rec: "Maurice Wutscher LLP",
        rationale: "Smaller, more accessible than the big consumer-finance firms. Reviews your contracts and gives the green light to start operating.",
        what: "Schedule a 1-hour initial consult ($300-500). Bring your servicing agreement and operating plan.",
        doneBy: "partner",
        costUsd: 400,
        minutes: 60,
        cta: { label: "See attorneys", href: "/app/setup/providers#attorney" },
      },
    ],
  },
  {
    id: "relationships",
    number: "02",
    duration: "Month 2",
    name: "Broker Relationships",
    emoji: "✷",
    totalCost: 0,
    goal: "Three broker introductions sent. One responded. Sample tapes in your inbox.",
    steps: [
      {
        id: "2.1",
        title: "Generate your Buyer Profile PDF",
        rec: "Use the Tradeline template",
        rationale: "Brokers ask for your profile first. Have a one-page PDF ready: firm, license/structure, capital, servicer, asset class focus.",
        what: "Tradeline drafts a buyer profile from your LLC + servicer + insurance details. Click to generate.",
        doneBy: "tradeline",
        costUsd: 0,
        minutes: 10,
        cta: { label: "Build profile", href: "/app/playbook" },
      },
      {
        id: "2.2",
        title: "Email Garnet Capital — supply-side broker",
        rec: "Garnet first",
        rationale: "Garnet covers mid-tier banks; they're the most likely to send a small new buyer a starter tape.",
        what: "Use the Tradeline-drafted intro email. Attach your buyer profile. Subject: 'New GA-based buyer — asset class fit'.",
        doneBy: "you",
        costUsd: 0,
        minutes: 15,
        cta: { label: "See Garnet", href: "/app/brokers" },
      },
      {
        id: "2.3",
        title: "Email RMG Investments + IndustryUp",
        rec: "Two more in parallel",
        rationale: "Cast a small net — three brokers maximizes response without diluting your follow-through quality.",
        what: "Same intro pattern. Personalize the asset-class line to match each broker's reputation.",
        doneBy: "you",
        costUsd: 0,
        minutes: 25,
        cta: { label: "Broker scripts", href: "/app/playbook" },
      },
      {
        id: "2.4",
        title: "Get on the radar for divestiture signals",
        rec: "Daily Today check",
        rationale: "By the time you have broker relationships, knowing which banks are about to list paper gives you a real edge.",
        what: "Visit /app/today every morning. The watch list tells you which banks to ask each broker about.",
        doneBy: "tradeline",
        costUsd: 0,
        minutes: 5,
        cta: { label: "Open Today", href: "/app/today" },
      },
    ],
  },
  {
    id: "first-deal",
    number: "03",
    duration: "Month 3",
    name: "First Deal",
    emoji: "$",
    totalCost: 15000,
    goal: "One small portfolio purchased. $5k-$25k purchase price. Tape transferred to your servicer.",
    steps: [
      {
        id: "3.1",
        title: "Evaluate the first tape from a broker",
        rec: "Use the Tape Copilot",
        rationale: "Tape Copilot parses the CSV in your browser, computes aggregates, and outputs a bid range with zero PII surfaced.",
        what: "When a broker sends a tape, drop it into /app/tools/tape. Read the bid recommendation.",
        doneBy: "tradeline",
        costUsd: 0,
        minutes: 15,
        cta: { label: "Open Tape Copilot", href: "/app/tools/tape" },
      },
      {
        id: "3.2",
        title: "Compute your disciplined bid",
        rec: "85% of max bid",
        rationale: "Max bid pencils your IRR. Disciplined bid leaves margin for surprises. Always submit disciplined, not max.",
        what: "The bid calculator already shows both. Submit the disciplined number.",
        doneBy: "tradeline",
        costUsd: 0,
        minutes: 5,
        cta: { label: "Bid calculator", href: "/app/tools/bid-calculator" },
      },
      {
        id: "3.3",
        title: "Submit the bid via the broker email template",
        rec: "Tradeline drafts it",
        rationale: "First-time bids need professionalism. Tradeline drafts the email; you review and send.",
        what: "Use the bid submission template in /app/playbook. Includes price + terms + signature.",
        doneBy: "tradeline",
        costUsd: 0,
        minutes: 10,
        cta: { label: "Bid template", href: "/app/playbook" },
      },
      {
        id: "3.4",
        title: "Close, wire, and transfer to NCB",
        rec: "Same-day wire",
        rationale: "Brokers reward fast wires. The day you sign, the wire goes out, the tape moves to your servicer.",
        what: "Wire from Mercury per the broker's instructions. Forward the encrypted tape file to NCB.",
        doneBy: "you",
        costUsd: 15000,
        minutes: 60,
        cta: { label: "Log in Pipeline", href: "/app/pipeline" },
      },
      {
        id: "3.5",
        title: "Log the deal in Tradeline",
        rec: "Pipeline → Portfolio",
        rationale: "Day-one operations means tracking. Pipeline marks the deal Won; Portfolio holds it. Hypothecation eligibility ticker starts.",
        what: "Mark the Pipeline deal Won. Add the holding to /app/portfolio with purchase date.",
        doneBy: "you",
        costUsd: 0,
        minutes: 10,
        cta: { label: "Open Portfolio", href: "/app/portfolio" },
      },
    ],
  },
  {
    id: "track-record",
    number: "04",
    duration: "Months 4-12",
    name: "Track Record",
    emoji: "▲",
    totalCost: 45000,
    goal: "3 closed deals across 2 brokers. Audited first year. First portfolio crosses 12-month seasoning.",
    steps: [
      {
        id: "4.1",
        title: "Close 2 more deals — same playbook",
        rec: "Same pattern, different brokers",
        rationale: "Repeating the workflow builds operating muscle and gives you cross-broker reference patterns.",
        what: "Repeat steps 3.1-3.5 with different brokers. Aim for one deal every 6-8 weeks.",
        doneBy: "you",
        costUsd: 30000,
        minutes: 300,
        cta: { label: "Open Pipeline", href: "/app/pipeline" },
      },
      {
        id: "4.2",
        title: "Audit your first year of operations",
        rec: "Pisenti & Brinker LLP",
        rationale: "GAAP audit is required for any future fund formation or institutional capital. Cost ~$15k for year 1.",
        what: "Engage a receivables-specialty CPA after 8-12 months of operations.",
        doneBy: "partner",
        costUsd: 15000,
        minutes: 0,
        cta: { label: "See CPAs", href: "/app/setup/providers#cpa" },
      },
      {
        id: "4.3",
        title: "Watch your first portfolio cross 12-month seasoning",
        rec: "Track in Portfolio",
        rationale: "12 months of clean payment history unlocks hypothecation. Tradeline's Portfolio page tracks the countdown.",
        what: "Check Portfolio monthly. When the eligibility badge flips green, you're ready for Stage 5.",
        doneBy: "tradeline",
        costUsd: 0,
        minutes: 5,
        cta: { label: "Open Portfolio", href: "/app/portfolio" },
      },
    ],
  },
  {
    id: "leverage",
    number: "05",
    duration: "Month 12+",
    name: "Leverage & Scale",
    emoji: "⤴",
    totalCost: 0,
    goal: "Hypothecation line opened. Borrowed proceeds redeployed. Operations doubled.",
    steps: [
      {
        id: "5.1",
        title: "Approach Webster Bank for hypothecation",
        rec: "Webster",
        rationale: "Webster's specialty-lending desk is the most accessible first hypothecation partner for small operators.",
        what: "Have your audited financials + servicer remittance reports ready. Cold-intro through your attorney.",
        doneBy: "you",
        costUsd: 0,
        minutes: 90,
        cta: { label: "See lenders", href: "/app/lenders" },
      },
      {
        id: "5.2",
        title: "Use proceeds to buy 2-3x more portfolios",
        rec: "Same disciplined process",
        rationale: "Leverage multiplies your operating capital but does not change your underwriting discipline. Same bid math, more deals.",
        what: "Each new portfolio: Tape Copilot → Bid calc → Pipeline → Portfolio. Just at higher volume.",
        doneBy: "you",
        costUsd: 0,
        minutes: 0,
        cta: { label: "Open Pipeline", href: "/app/pipeline" },
      },
      {
        id: "5.3",
        title: "Decide your Year-2 expansion",
        rec: "Pick one: state OR asset class",
        rationale: "Don't expand both at once. Either add a second licensed state (e.g. VA) or a second asset class (e.g. junior mortgages).",
        what: "Open Capital Allocation playbook. Use the calculator with your current cash position to decide.",
        doneBy: "tradeline",
        costUsd: 0,
        minutes: 30,
        cta: { label: "Capital playbook", href: "/app/capital" },
      },
    ],
  },
];

function totalStepCount(): number {
  return STAGES.reduce((s, st) => s + st.steps.length, 0);
}

function totalCost(): number {
  return STAGES.reduce((s, st) => s + st.totalCost, 0);
}

function formatUSD(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n}`;
}

const DONE_BY_LABEL: Record<Step["doneBy"], { label: string; tone: string }> = {
  you: {
    label: "You do this",
    tone: "text-[color:var(--color-fg)] border-[color:var(--color-line-strong)]",
  },
  tradeline: {
    label: "Tradeline does this",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)]",
  },
  partner: {
    label: "A partner does this",
    tone: "text-[color:var(--color-accent-3)] border-[color:var(--color-accent-3)]",
  },
};

export function PathBoard() {
  const { completed, hydrated, toggle } = usePathProgress();
  const totalSteps = totalStepCount();
  const totalCompletedSteps = completed.size;

  return (
    <div className="space-y-12">
      {/* PROGRESS HEADER */}
      <section className="card-hero p-8 md:p-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2">
            <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Your path
            </div>
            <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
              From zero to{" "}
              <span className="italic text-gradient-accent">leveraged operator</span>{" "}
              in 12 months.
            </h1>
            <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-2xl">
              Tradeline has already picked the best of every decision: state,
              servicer, bank, insurance carrier, attorney, broker, lender. You
              just follow the steps. {totalSteps} of them, grouped into 5 stages.
            </p>
          </div>
          <div>
            <ProgressBar completed={totalCompletedSteps} total={totalSteps} />
            <div className="mt-6 grid grid-cols-2 gap-3 text-[13px]">
              <div className="card p-3">
                <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  Total cost
                </div>
                <div className="mt-1 font-mono text-[18px] text-[color:var(--color-fg)] tick">
                  {formatUSD(totalCost())}
                </div>
              </div>
              <div className="card p-3">
                <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  Timeline
                </div>
                <div className="mt-1 font-mono text-[18px] text-[color:var(--color-fg)] tick">
                  ~12 mo
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STAGES */}
      {STAGES.map((stage) => {
        const stageComplete = stage.steps.every((s) => completed.has(s.id));
        const stageStepsDone = stage.steps.filter((s) =>
          completed.has(s.id)
        ).length;
        return (
          <section key={stage.id} id={stage.id} className="space-y-5">
            {/* Stage header */}
            <div className="card-elevated p-7 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-56 h-56 opacity-30 pointer-events-none">
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(245, 166, 35, 0.4), transparent 70%)",
                  }}
                />
              </div>
              <div className="relative">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-[32px] text-[color:var(--color-accent)] tick">
                    {stage.number}
                  </span>
                  <span className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                    {stage.duration}
                  </span>
                  {stageComplete && (
                    <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded border border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]">
                      ✓ stage done
                    </span>
                  )}
                  {!stageComplete && (
                    <span className="text-[12px] text-[color:var(--color-fg-faint)] font-mono">
                      {stageStepsDone}/{stage.steps.length} done
                    </span>
                  )}
                </div>
                <h2 className="mt-2 font-serif text-3xl md:text-4xl tracking-tight">
                  Stage {Number(stage.number)} ·{" "}
                  <span className="italic">{stage.name}</span>
                </h2>
                <p className="mt-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
                  {stage.goal}
                </p>
                {stage.totalCost > 0 && (
                  <div className="mt-4 text-[12px] text-[color:var(--color-fg-faint)] font-mono">
                    Stage cost · ~{formatUSD(stage.totalCost)}
                  </div>
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3 ml-0 md:ml-6">
              {stage.steps.map((step) => {
                const done = completed.has(step.id);
                const doneByCopy = DONE_BY_LABEL[step.doneBy];
                return (
                  <article
                    key={step.id}
                    className={`card p-5 md:p-6 transition ${
                      done ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start gap-4 md:gap-5">
                      {hydrated && (
                        <StepCheckbox
                          stepId={step.id}
                          completed={done}
                          onToggle={() => toggle(step.id)}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <h3
                            className={`font-serif text-[20px] md:text-[22px] text-[color:var(--color-fg)] tracking-tight leading-snug ${
                              done ? "line-through opacity-70" : ""
                            }`}
                          >
                            {step.title}
                          </h3>
                          <span
                            className={`text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded border whitespace-nowrap ${doneByCopy.tone}`}
                          >
                            {doneByCopy.label}
                          </span>
                        </div>

                        {/* Recommendation card */}
                        <div className="mt-3 flex items-baseline gap-3 flex-wrap text-[14px]">
                          <span className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                            Our pick
                          </span>
                          <span className="text-[color:var(--color-accent)] font-medium">
                            {step.rec}
                          </span>
                        </div>

                        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                          <span className="text-[color:var(--color-fg)]">Why:</span>{" "}
                          {step.rationale}
                        </p>
                        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                          <span className="text-[color:var(--color-fg)]">What:</span>{" "}
                          {step.what}
                        </p>

                        {/* Cost + time + CTA */}
                        <div className="mt-4 flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-3 text-[11px] text-[color:var(--color-fg-faint)] font-mono">
                            <span>
                              {step.costUsd > 0 ? formatUSD(step.costUsd) : "free"}
                            </span>
                            <span>·</span>
                            <span>
                              {step.minutes >= 60
                                ? `${Math.round(step.minutes / 60)}h`
                                : `${step.minutes}m`}
                            </span>
                          </div>
                          {step.cta.external ? (
                            <a
                              href={step.cta.href}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary"
                            >
                              {step.cta.label}
                            </a>
                          ) : (
                            <Link
                              href={step.cta.href as never}
                              className="btn-primary"
                            >
                              {step.cta.label}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* COMPLETION CTA */}
      {completed.size === totalSteps && (
        <section className="card-hero p-8 md:p-12 text-center">
          <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-accent)]">
            Path complete
          </div>
          <h2 className="mt-3 font-serif text-3xl md:text-5xl tracking-tight">
            You&rsquo;re a leveraged operator.
          </h2>
          <p className="mt-4 text-[color:var(--color-fg-dim)] text-lg max-w-2xl mx-auto">
            What&rsquo;s next: Year 2 expansion. Pick a second state or a second
            asset class. Tradeline&rsquo;s Capital playbook does the math.
          </p>
          <div className="mt-7">
            <Link href="/app/capital" className="btn-mega">
              Open Capital playbook
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
