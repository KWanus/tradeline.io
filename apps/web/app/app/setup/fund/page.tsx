import Link from "next/link";
import { ReadinessScorecard, type MilestoneItem } from "./_readiness";

export const dynamic = "force-dynamic";

type Year = {
  year: string;
  label: string;
  what: string;
  why: string;
  cost: string;
  tone: "now" | "next" | "later" | "endgame";
};

const TIMELINE: Year[] = [
  {
    year: "Year 1",
    label: "Solo operator, your money",
    what: "LLC, license, 3-5 first deals using your own capital. Document everything for the audit trail you'll need later.",
    why: "Investors won't fund you without a track record. The cleanest way to build one is to deploy your own capital first.",
    cost: "$10k-$50k starting capital, $5k-$30k legal/setup",
    tone: "now",
  },
  {
    year: "Year 2",
    label: "Operations + first leverage",
    what: "10-20 deals across 2-3 brokers. First hypothecation. Hire your first employee (analyst or ops manager).",
    why: "Build operating muscle. Hypothecation proves the leverage thesis works on your specific underwriting model.",
    cost: "$50k-$150k operating capital",
    tone: "next",
  },
  {
    year: "Year 3",
    label: "Audited returns + maybe C-Corp parent",
    what: "30+ deals. Audit your last 2 years (CPA-issued GAAP financials). At this point, evaluate forming a C-Corp parent if fund-formation is on the horizon.",
    why: "LPs require 3+ years of audited returns. The C-Corp question only matters if you're definitely raising outside capital — most operators stay LLC forever.",
    cost: "$15k-$30k for first audit; $5k-$15k for C-Corp restructure if needed",
    tone: "later",
  },
  {
    year: "Year 4",
    label: "Fund formation",
    what: "Form LP (the fund) + GP (you, plus any partners). Hire SEC counsel, fund administrator, auditor. Reg D Rule 506(b) or 506(c) filing. Anti-money-laundering + qualified custodian setup. Begin LP outreach.",
    why: "Real fund formation. You're now subject to SEC oversight; every LP relationship is documented. Most first-time managers raise $5M-$25M from family offices and HNW individuals.",
    cost: "$150k-$500k upfront (legal, fund admin, audit, placement)",
    tone: "later",
  },
  {
    year: "Year 5+",
    label: "Portfolio manager — staff handles ops",
    what: "You're now a 'portfolio manager.' Day-to-day operations (broker calls, tape eval, servicer mgmt) handled by your COO + team. You make capital allocation decisions, raise next fund, manage LP relationships.",
    why: "This is the Year-5 vision. The operating work that consumed Year 1-3 is now handled by employees you trained and an outside agency you contracted. You spend your time on strategy and capital.",
    cost: "Fund management fee (1.5-2% of AUM) covers staff; you take carry (15-20% of profits) on top",
    tone: "endgame",
  },
];

const TONE_STYLE: Record<Year["tone"], string> = {
  now: "border-[color:var(--color-accent)] text-[color:var(--color-accent)]",
  next: "border-[color:var(--color-warn)] text-[color:var(--color-warn)]",
  later: "border-[color:var(--color-line-strong)] text-[color:var(--color-fg)]",
  endgame: "border-[color:var(--color-line)] text-[color:var(--color-fg-faint)]",
};

const TONE_LABEL: Record<Year["tone"], string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  endgame: "Endgame",
};

const STRUCTURE_COMPARISON = [
  {
    aspect: "Federal tax",
    llc: "Pass-through. You pay personal income tax (24-37%) on profits.",
    ccorp: "Double taxation. 21% corporate + 15-20% dividend tax = ~37-40% effective.",
  },
  {
    aspect: "Setup cost",
    llc: "$200-$1,500 (varies by state)",
    ccorp: "$2,000-$15,000 (more legal complexity, board minutes, etc.)",
  },
  {
    aspect: "Annual maintenance",
    llc: "Minimal (annual report, registered agent fee)",
    ccorp: "Higher (board minutes, separate corporate tax return, maybe state franchise tax)",
  },
  {
    aspect: "Raising outside capital",
    llc: "Hard. Investors strongly prefer C-Corp for liability and exit reasons.",
    ccorp: "Required for most VC / institutional LP money. RIAs and family offices accept C-Corp cleanly.",
  },
  {
    aspect: "Single owner control",
    llc: "Simple. You can be the only member.",
    ccorp: "Manageable but adds board/officer formalities even with one shareholder.",
  },
  {
    aspect: "Best for",
    llc: "Years 1-3, before raising outside capital. Most operators stay LLC permanently.",
    ccorp: "Year 3-4+, when fund formation is imminent. Otherwise it's a tax mistake.",
  },
];

const LP_TYPES = [
  {
    name: "High-net-worth individuals (HNWI)",
    typical: "$100k-$1M check sizes",
    requirements: "Accredited investor (>$1M net worth ex-residence, or $200k+ income)",
    track_record: "1-3 years of self-deployed deals; audited preferred",
    notes: "Easiest first capital. Often friends/family + extended network. Reg D 506(b) lets you raise from up to 35 non-accredited if you have a substantive relationship, but most NPL funds stick to 506(c) accredited-only.",
  },
  {
    name: "Family offices (single + multi)",
    typical: "$1M-$10M check sizes",
    requirements: "Single-family offices manage 1 family; multi-family offices have 5-50+ families",
    track_record: "3-5 years of audited returns minimum; some require institutional-quality reporting",
    notes: "Slow decision cycles (3-6 months from pitch to commitment). Once they invest, they often anchor subsequent funds. Highly relationship-driven — usually accessed via prior introductions.",
  },
  {
    name: "Registered Investment Advisors (RIAs)",
    typical: "$500k-$5M per RIA, allocated across their HNW clients",
    requirements: "RIA does diligence; clients decide via individual investment management agreement",
    track_record: "3+ years audited; institutional-quality monthly NAV reporting",
    notes: "Steady capital once you're approved on their platform. Most RIAs only allocate to a small set of alternative managers, so getting approved is competitive but durable.",
  },
  {
    name: "Fund-of-funds",
    typical: "$2M-$20M check sizes",
    requirements: "Diversified across many alternative managers; do their own diligence",
    track_record: "5+ years audited returns; second or third fund typically",
    notes: "Patient capital but they need vintage diversification, so they often pace commitments across years. Hard for first-time fund managers.",
  },
  {
    name: "Pension funds + endowments",
    typical: "$10M-$100M",
    requirements: "Institutional gatekeepers, consultant approval",
    track_record: "10+ years of institutional-quality history. Second-generation managers only.",
    notes: "Don't pitch these in your first fund. Year 8+ if at all.",
  },
];

const MILESTONES_BEFORE_FUND: MilestoneItem[] = [
  { id: "ten-deals", label: "Closed and settled at least 10 NPL deals using your own capital" },
  { id: "audited-years", label: "Two consecutive years of CPA-audited financial statements (GAAP)" },
  { id: "underwriting-doc", label: "Documented underwriting model (written down, not in your head)" },
  { id: "servicing-msa", label: "Master servicing agreement with at least one Tier-1 servicer" },
  { id: "eando-insurance", label: "E&O insurance with $1M+ coverage; receivables-management endorsement" },
  { id: "irr-15", label: "Net-of-fees IRR > 15% across your operating history" },
  { id: "clean-compliance", label: "Clean compliance history: no AG actions, no CFPB inquiries, no class actions" },
  { id: "credibility", label: "Industry credibility: speaking at RMAI, written content, broker references" },
];

export default function FundFormationPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <header className="mb-10">
        <Link
          href="/app/setup"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
        >
          &larr; Back to Setup
        </Link>
        <div className="mt-3 font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          The endgame
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          The path from operator to fund manager.
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg leading-relaxed">
          Someone may have told you to &ldquo;get a C-Corp, hire people, run a
          fund.&rdquo; That&rsquo;s the Year-4-5 version of this business
          presented as if it&rsquo;s Year 1. Here&rsquo;s the actual path —
          honest about the time, the cost, and the gates.
        </p>
      </header>

      {/* HEADLINE WARNING */}
      <section className="mb-10 border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          Read this before anything else
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          You cannot skip directly to running a fund. <strong>LPs require track
          records you can&rsquo;t fake</strong>: 3-5 years of audited deals
          using your own capital, clean compliance history, an actual
          underwriting model. People who skip this and try to raise on a pitch
          deck either fail to raise (most common) or end up subject to SEC
          enforcement actions (catastrophic).
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          The Year-1 to Year-3 work is not a bug. It&rsquo;s how the LPs in
          Year 4 verify that you can do what you say you can do.
        </p>
      </section>

      {/* TIMELINE */}
      <Section label="The 5-year path" tag="01">
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
          {TIMELINE.map((y) => (
            <div key={y.year} className="px-5 py-5 flex items-start gap-5 flex-wrap">
              <div className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] w-16 shrink-0 pt-0.5">
                {y.year}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="text-[16px] text-[color:var(--color-fg)] font-medium">
                  {y.label}
                </div>
                <div className="mt-1.5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {y.what}
                </div>
                <div className="mt-2 text-[13px] text-[color:var(--color-fg-faint)] leading-relaxed">
                  <span className="text-[color:var(--color-fg-dim)]">Why:</span> {y.why}
                </div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
                  Cost: {y.cost}
                </div>
              </div>
              <span
                className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border ${TONE_STYLE[y.tone]}`}
              >
                {TONE_LABEL[y.tone]}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* C-CORP vs LLC */}
      <Section label="C-Corp vs LLC — which entity?" tag="02">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg-dim)] mb-5">
          The advice you may have heard is probably right at the wrong time.
          C-Corp is the <em>endgame</em> structure for raising outside capital.
          For Year 1-3, LLC is almost always correct.
        </p>
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]">
          <table className="w-full font-mono text-[12px]">
            <thead className="text-[color:var(--color-fg-faint)] tracking-[0.18em] text-[10px] uppercase">
              <tr className="border-b border-[color:var(--color-line)]">
                <th className="px-4 py-3 text-left font-normal">Aspect</th>
                <th className="px-4 py-3 text-left font-normal">LLC</th>
                <th className="px-4 py-3 text-left font-normal">C-Corp</th>
              </tr>
            </thead>
            <tbody>
              {STRUCTURE_COMPARISON.map((row) => (
                <tr
                  key={row.aspect}
                  className="border-b border-[color:var(--color-line)] last:border-b-0"
                >
                  <td className="px-4 py-3 align-top text-[color:var(--color-accent)] w-32">
                    {row.aspect}
                  </td>
                  <td className="px-4 py-3 align-top text-[color:var(--color-fg-dim)] leading-relaxed">
                    {row.llc}
                  </td>
                  <td className="px-4 py-3 align-top text-[color:var(--color-fg-dim)] leading-relaxed">
                    {row.ccorp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Decision rule
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            <strong>Form an LLC for Year 1.</strong> If by Year 3 you have an
            LP commitment from a serious investor, restructure to a C-Corp at
            that point — your fund counsel will guide you through the
            tax-efficient conversion. Forming a C-Corp at Year 1 with no
            outside capital is a tax mistake that costs you 10-15% of every
            dollar of profit.
          </p>
        </div>
      </Section>

      {/* MILESTONES — now interactive scorecard */}
      <Section label="What you must have BEFORE raising a fund" tag="03">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg-dim)] mb-4">
          Every LP will ask for these. Missing any one of them disqualifies you
          for institutional capital. Tick each off as you complete it —
          progress is saved locally so this page becomes your fund-readiness
          dashboard.
        </p>
        <ReadinessScorecard milestones={MILESTONES_BEFORE_FUND} />
      </Section>

      {/* LP TYPES */}
      <Section label="Who actually invests in NPL funds?" tag="04">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg-dim)] mb-4">
          Not all LPs are created equal. Most first-time managers raise from
          HNWI and family offices; institutional capital comes Years 5+.
        </p>
        <div className="space-y-3">
          {LP_TYPES.map((lp) => (
            <article
              key={lp.name}
              className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5"
            >
              <h3 className="text-lg font-medium text-[color:var(--color-fg)]">
                {lp.name}
              </h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Typical check">{lp.typical}</Field>
                <Field label="Eligibility">{lp.requirements}</Field>
                <Field label="Track-record bar">{lp.track_record}</Field>
              </div>
              <p className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {lp.notes}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* FUND-FORMATION COSTS */}
      <Section label="Fund-formation cost breakdown" tag="05">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg-dim)] mb-4">
          What it actually costs to set up a $5-25M first NPL fund. Charge
          these against management fees once you raise; pay out of pocket
          before then.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CostCard
            label="Fund counsel (LP agreement, PPM, subscription docs)"
            range="$50,000 – $150,000"
            note="Limited Partnership Agreement (LPA) is the core contract; PPM is the disclosure document for LPs. Hire a fund-formation specialist firm; don't use a generalist."
          />
          <CostCard
            label="Fund administrator"
            range="$15,000 – $50,000/yr"
            note="NAV calculation, LP reporting, capital calls, distributions. Standard providers: SS&C, Apex, Trident."
          />
          <CostCard
            label="Auditor"
            range="$15,000 – $50,000/yr"
            note="GAAP audit of fund financials. Required by all institutional LPs; recommended even for HNWI funds."
          />
          <CostCard
            label="SEC + state filings"
            range="$5,000 – $25,000 setup"
            note="Reg D Form D filing; blue-sky filings in every state where an LP lives. Form ADV if you cross the RIA threshold ($150M AUM)."
          />
          <CostCard
            label="Placement agent (optional)"
            range="2-5% of capital raised"
            note="Third-party broker-dealer that helps you raise. Required to be a licensed broker-dealer. Most first-time funds skip and raise from network."
          />
          <CostCard
            label="E&O + D&O insurance"
            range="$10,000 – $30,000/yr"
            note="Errors & Omissions covers professional liability; Directors & Officers covers governance. Required by most LPs."
          />
          <CostCard
            label="Qualified custodian"
            range="$10,000 – $25,000/yr"
            note="SEC-compliant custodian for fund assets. Specialty providers (Inspira, Equity Trust) handle alternative-asset custody."
          />
          <CostCard
            label="Compliance consultant"
            range="$30,000 – $80,000/yr"
            note="Outsourced Chief Compliance Officer (CCO). Required by SEC if you're an RIA."
          />
        </div>
        <div className="mt-5 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            All-in first-year fund cost
          </div>
          <div className="mt-2 font-mono text-2xl text-[color:var(--color-accent)] tick">
            $150,000 – $500,000
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Spend this BEFORE you have a single LP commitment. If you raise
            $10M at 1.5% management fee = $150k/yr — your operating costs are
            covered but barely. You make real money on the carry (15-20% of
            profits) over multi-year vintage.
          </p>
        </div>
      </Section>

      {/* SEC OVERVIEW */}
      <Section label="The SEC reality" tag="06">
        <p className="text-[15px] leading-relaxed text-[color:var(--color-fg)] mb-4">
          The SEC regulates two distinct activities in fund management:
        </p>
        <div className="space-y-3">
          <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
            <div className="text-[15px] font-medium text-[color:var(--color-fg)]">
              Regulation D — How you raise capital
            </div>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              <strong>Rule 506(b)</strong> — raise from up to 35 non-accredited
              investors with a pre-existing substantive relationship; no
              general advertising. The most common path for first funds.
              <br />
              <strong>Rule 506(c)</strong> — raise from accredited investors
              only; you can advertise publicly. More flexibility but every LP
              must be verified accredited (third-party verification, not just
              self-attestation).
            </p>
          </div>
          <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
            <div className="text-[15px] font-medium text-[color:var(--color-fg)]">
              Investment Advisers Act — How you manage capital
            </div>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              Below $150M AUM: file as a state-registered RIA in your state.
              Above $150M: federal SEC RIA registration via Form ADV (60-page
              filing). Annual update + 5-year examination cycle. Compliance
              officer required.
              <br />
              <strong>Note:</strong> there&rsquo;s a "private fund adviser
              exemption" if you only manage private funds and have less than
              $150M — you&rsquo;re an "exempt reporting adviser" with reduced
              requirements but still file.
            </p>
          </div>
          <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
            <div className="text-[15px] font-medium text-[color:var(--color-fg)]">
              State blue-sky laws
            </div>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              Every state where you have an LP requires a "blue sky" filing.
              Standard fee is $300-$1,500 per state. Your fund counsel handles
              this; budget for it.
            </p>
          </div>
        </div>
        <div className="mt-5 border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
            Don&rsquo;t skip this
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            People who try to raise outside capital without proper SEC
            registration end up in SEC enforcement actions. The penalties are
            personal (you, not just the fund) and career-ending. This is the
            single most expensive area to cut corners on.
          </p>
        </div>
      </Section>

      {/* WHERE TO START */}
      <Section label="What to do this year (Year 1)" tag="07">
        <div className="border border-[color:var(--color-accent-dim)] bg-[color:var(--color-bg-1)] p-6">
          <p className="text-[15px] text-[color:var(--color-fg)] leading-relaxed">
            Forget the fund for now. The right move in Year 1 is{" "}
            <strong>operate</strong>:
          </p>
          <ul className="mt-3 space-y-1.5 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            <li>
              Form your LLC, get licensed, build broker relationships — see{" "}
              <Link href="/app/setup" className="text-[color:var(--color-accent)] hover:underline">
                /app/setup
              </Link>
            </li>
            <li>
              Close your first 3-5 deals using your own capital ($25-100k)
            </li>
            <li>Track every deal in /app/pipeline and /app/portfolio</li>
            <li>
              Audit your first year of operations (~$15k from a receivables-
              specialty CPA — see /app/setup/providers)
            </li>
            <li>
              Document your underwriting model (write it down — this becomes
              your fund pitch deck three years from now)
            </li>
          </ul>
          <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            By Year 3 you&rsquo;ll have audited returns, a closed-deal track
            record, and operating muscle. <em>Then</em> the fund-formation
            playbook becomes operational. Trying to start at Year 4 with a
            pitch deck and no track record is how courses are sold and SEC
            cases are made.
          </p>
        </div>
      </Section>

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Educational content. Not legal, financial, or investment advice. Fund
        formation is regulated; consult fund counsel and a securities attorney
        before raising any outside capital.
      </p>
    </main>
  );
}

function Section({
  label,
  tag,
  children,
}: {
  label: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-4">
        <span className="text-[color:var(--color-accent)]">{tag}</span>
        <span className="h-px w-8 bg-[color:var(--color-line-strong)]" />
        <span>{label}</span>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--color-fg)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function CostCard({
  label,
  range,
  note,
}: {
  label: string;
  range: string;
  note: string;
}) {
  return (
    <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className="mt-2 font-mono text-[16px] text-[color:var(--color-accent)]">
        {range}
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {note}
      </p>
    </div>
  );
}
