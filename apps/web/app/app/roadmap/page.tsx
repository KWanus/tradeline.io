import Link from "next/link";

export const dynamic = "force-dynamic";

type YearRow = {
  year: string;
  shape: string;
  unlock: string;
  metric: string;
  state: "now" | "next" | "later" | "vision";
};

const ARC: YearRow[] = [
  {
    year: "Year 1",
    shape: "Data product",
    unlock: "Public-source NPL signals · MCP-native · email + dashboard",
    metric: "$5k MRR · 25 customers · 2 paid reports",
    state: "now",
  },
  {
    year: "Year 2",
    shape: "Workflow platform",
    unlock: "Pipeline · Portfolio · Compliance · Brokers · Servicers · Tape copilot · Earnings-call AI",
    metric: "$50k MRR · 75 customers · own-arm has bought 2-3 portfolios",
    state: "next",
  },
  {
    year: "Year 3",
    shape: "Marketplace + benchmarks",
    unlock: "Mediated bid platform · anonymized collection benchmarks · standardized tape schema · buyer reputation scoring · hypothecation directory",
    metric: "$500k MRR · 200 customers · marketplace beta with 3 brokers",
    state: "later",
  },
  {
    year: "Year 4",
    shape: "Adjacent assets",
    unlock: "Auto · Student loans · Medical · Equipment · Tax liens · Junior mortgages · UK + EU NPL",
    metric: "$5M ARR · 1,000+ customers · 5+ verticals live",
    state: "vision",
  },
  {
    year: "Year 5",
    shape: "Industry infrastructure",
    unlock: "White-label SDK for bank divestiture desks · regulator dashboards · embedded in insurance underwriting",
    metric: "Industry standard. Every meaningful US NPL transaction touches Tradeline.",
    state: "vision",
  },
];

const FEATURES: { title: string; why: string; phase: string }[] = [
  {
    title: "Tape evaluation copilot",
    why: "Paste a CSV (aggregates only, no PII to us); get instant scoring + originator context + comparable-deal benchmarks. The single most painful manual workflow in the industry. The killer-feature wedge for the Pro tier.",
    phase: "Year 2",
  },
  {
    title: "Earnings-call AI",
    why: "Every quarterly call across our 31 banks transcribed and signal-extracted within 1 hour. The radar already monitors filings; this is the other half of the public-disclosure surface.",
    phase: "Year 2",
  },
  {
    title: "Broker tape watchlist",
    why: "Track every broker’s posting cadence and cohort; pre-filter to tapes you’d actually bid on. Forces brokers to either work with us or lose deal-flow visibility.",
    phase: "Year 2",
  },
  {
    title: "Hypothecation eligibility tracker",
    why: "Once you own paper, see which lenders take it as collateral, at what advance rate. Closes the loop on the founder’s original vision (buy → re-perform → leverage). Indispensable to a leveraged buyer.",
    phase: "Year 2",
  },
  {
    title: "Anonymized collection benchmarks",
    why: "Compare your portfolio’s recovery rate against the cohort median, by asset class and vintage. Each customer added makes benchmarks better — the network effect competitors can’t replicate.",
    phase: "Year 3",
  },
  {
    title: "Servicer report card",
    why: "Automated remittance reconciliation; performance vs peers across your servicer panel. Big buyers use 3–5 servicers and nobody compares them well.",
    phase: "Year 3",
  },
  {
    title: "Mediated bid platform",
    why: "Tradeline-hosted tape preview + blind bidding. We take 1–2% of transaction value. Marketplace moat. Heavy regulatory work — be careful.",
    phase: "Year 3+",
  },
  {
    title: "Buyer reputation scoring",
    why: "Close rates, post-close behavior, broker references. Natural complement to the bid platform. Controls who can participate in the protocol.",
    phase: "Year 3+",
  },
  {
    title: "Cross-asset expansion",
    why: "Auto, student, medical, judgments, junior mortgages, equipment, commercial. Same shape, different vertical. Multiplies the revenue ceiling 5×.",
    phase: "Year 3+",
  },
  {
    title: "International NPL",
    why: "UK, Italy, Spain, LATAM. Different statutes, same protocol. Moats are even softer abroad.",
    phase: "Year 4+",
  },
  {
    title: "Embedded SDK for banks",
    why: "Let originators run their own divestiture desks on top of Tradeline. White-label. Year 5 infrastructure play.",
    phase: "Year 5",
  },
  {
    title: "AI underwriting copilot",
    why: "Agent that reads thousands of historical tapes and tells you what features predict collection. Eventually hosts proprietary models that can’t be replicated without the data.",
    phase: "Year 3+",
  },
];

const MOATS: { title: string; body: string }[] = [
  {
    title: "Aggregated divestiture-timing visibility",
    body: "We see the public signals (SEC + XBRL + news + court) that predict bank divestitures faster and cleaner than any single buyer can. Customers tell us which signals matured into deals — that ground-truth feedback loop is irreproducible without our customer base.",
  },
  {
    title: "Anonymized cross-portfolio benchmarks",
    body: "Once buyers run their own portfolios on Tradeline (Year 2+), we hold the largest anonymized dataset of NPL collection performance in the industry. Nobody else can build this product because nobody else has the customer set.",
  },
  {
    title: "Standardized tape format + reputation",
    body: "Today every broker emails CSVs in their own format; every buyer parses them by hand. If Tradeline becomes the default ingestion + normalization layer, we become the FIX/SWIFT of NPL — the protocol everyone has to speak. Combined with buyer-reputation scoring, we control market access.",
  },
];

const NEVER: { title: string; body: string }[] = [
  {
    title: "Not a Consumer Reporting Agency",
    body: "We never assemble or score consumer-level credit/payment profiles for third-party decisions. The CRA registration + audit burden destroys margins and constrains the product. Forever-no.",
  },
  {
    title: "Not a debt collector or servicer",
    body: "Even when our internal arm (Year 2+) holds licenses, the SaaS company stays software. Servicing happens at third-party servicers we report on, not operate.",
  },
  {
    title: "Not a broker-dealer",
    body: "We can mediate bids on a marketplace without broker-dealer registration if we’re careful — the platform connects parties, doesn’t take principal risk. That distinction is load-bearing.",
  },
  {
    title: "Not a fund manager",
    body: "‘Tradeline Capital’ might happen Year 4+ as a separate entity if the data moat warrants it. SaaS and the fund stay distinct businesses with separate regulators and separate boards.",
  },
];

const STATE_TONE: Record<YearRow["state"], string> = {
  now: "border-[color:var(--color-accent)] text-[color:var(--color-accent)]",
  next: "border-[color:var(--color-warn)] text-[color:var(--color-warn)]",
  later: "border-[color:var(--color-line-strong)] text-[color:var(--color-fg)]",
  vision: "border-[color:var(--color-line)] text-[color:var(--color-fg-faint)]",
};

const STATE_LABEL: Record<YearRow["state"], string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  vision: "Vision",
};

export default function RoadmapPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <header className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Where we&rsquo;re going
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          The plan to be the standard.
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          We get there by stacking moats. Year 1 a data product. Year 2 a workflow platform. Year
          3 the marketplace and the benchmark. Year 5 we&rsquo;re infrastructure no one wants to
          compete with. Each layer feeds the next.
        </p>
      </header>

      <section className="mb-12">
        <SectionLabel>The five-year arc</SectionLabel>
        <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
          {ARC.map((row) => (
            <div key={row.year} className="px-5 py-5 flex items-start gap-5 flex-wrap">
              <div className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] w-16 shrink-0 pt-0.5">
                {row.year}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="text-[16px] text-[color:var(--color-fg)] font-medium">
                  {row.shape}
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
                  {row.unlock}
                </div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
                  {row.metric}
                </div>
              </div>
              <span
                className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border ${STATE_TONE[row.state]}`}
              >
                {STATE_LABEL[row.state]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <SectionLabel>The three moats that compound</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {MOATS.map((m) => (
            <div
              key={m.title}
              className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5"
            >
              <div className="text-[15px] font-medium text-[color:var(--color-fg)] leading-snug">
                {m.title}
              </div>
              <div className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {m.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <SectionLabel>Twelve features that make us indispensable</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[15px] font-medium text-[color:var(--color-fg)]">
                  {f.title}
                </div>
                <span className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-fg-faint)]">
                  {f.phase}
                </span>
              </div>
              <div className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {f.why}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <SectionLabel>What we are NOT — even at full vision</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {NEVER.map((n) => (
            <div
              key={n.title}
              className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5"
            >
              <div className="text-[14px] font-medium text-[color:var(--color-warn)]">{n.title}</div>
              <div className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {n.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <SectionLabel>The AI-native bet</SectionLabel>
        <div className="mt-4 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
          <p className="text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            By 2027, every serious NPL buyer has an AI agent on their team. The buyers who give
            that agent access to Tradeline data run circles around the ones still logging into a
            portal. Tradeline already ships an MCP server (deal-radar) so a buyer&rsquo;s Claude
            can answer:
          </p>
          <pre className="mt-4 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] p-4 font-mono text-[12px] text-[color:var(--color-fg)] overflow-x-auto leading-relaxed">
{`> claude --mcp tradeline.deal-radar
   "What regional banks have charge-offs accelerating
    over 100% YoY, no recent broker-side news, and trade
    in states where I'm licensed? Pull the last 4 quarters
    of XBRL data for the top 3."`}
          </pre>
          <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            That&rsquo;s not a dashboard query. It&rsquo;s analyst-replacement. Once we win the
            agent layer, displacing us means rebuilding the agent integration AND the data pipeline
            AND the customer relationships.
          </p>
        </div>
      </section>

      <section className="mb-16">
        <SectionLabel>Reality checks</SectionLabel>
        <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed space-y-2.5">
          <p>
            <span className="text-[color:var(--color-fg)]">Phase 1:</span> none of this matters if 5
            buyer-discovery calls don&rsquo;t confirm pain. The roadmap gates everything on that.
          </p>
          <p>
            <span className="text-[color:var(--color-fg)]">Phase 2:</span> if churn is over 10%
            monthly, we don&rsquo;t have product-market fit, we have product-market interest. Fix
            retention before adding features.
          </p>
          <p>
            <span className="text-[color:var(--color-fg)]">Phase 3:</span> the marketplace +
            benchmarking moves are 5–10× harder than the data product. Don&rsquo;t start them until
            $50k+ MRR proves the business.
          </p>
          <p>
            <span className="text-[color:var(--color-fg)]">Phase 4–5:</span> these phases happen
            because Phase 1–3 went well. Don&rsquo;t pitch international expansion in a deck for a
            $5k-MRR company. Until you can.
          </p>
        </div>
      </section>

      <p className="text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Long-form companion lives at <code className="text-[color:var(--color-fg)]">docs/VISION.md</code>{" "}
        in the repo. This page summarizes; the doc goes deeper. The roadmap will get out of date —
        when it does, update both.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/app/today"
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          &larr; Back to today
        </Link>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
      {children}
    </div>
  );
}
