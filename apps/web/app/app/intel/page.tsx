import Link from "next/link";

export const dynamic = "force-dynamic";

const TOP_FINDINGS = [
  {
    n: "01",
    title: "The deal-radar niche is genuinely empty.",
    body:
      "No incumbent — not NLEX ($250B+ cumulative GMV), not EverChain, not Debexpert, not Garnet, not insideARM — produces a per-bank divestiture-probability score from public-source filings. Auction platforms react to listings; trade press reports after the fact. Tradeline's Radar is structurally first-mover. The window is ~12 months before EverChain or Debexpert (both modern-stack, well-resourced) could replicate.",
  },
  {
    n: "02",
    title: "EverChain is the real threat — not Bloomberg.",
    body:
      "Bloomberg/S&P Capital IQ price themselves out of the long-tail debt-buyer market ($30k/seat vs. Tradeline's $99–899/mo). The actual replication risk sits with EverChain — they already have compliance positioning, certified-buyer relationships, and a December 2025 platform relaunch. Strategic implication: ship a partnership/integration with EverChain and Debexpert before they build deal-radar themselves.",
  },
  {
    n: "03",
    title: "Pricing is defensible. Supply-side Enterprise is underpriced.",
    body:
      "Buy-side tiers ($99/$299/$899) track market comps within ±20%. Supply-side Enterprise at $4,999/mo is materially below where Curinos/Argus charge ($50k+/yr) for comparable institutional intelligence. Room for a $9,999/mo Fund-of-Funds tier once 3–5 logos exist.",
  },
];

const THREATS = [
  {
    rank: "1",
    name: "EverChain",
    risk: "highest",
    why: "Already has compliance posture, certified buyer network, modern stack. If they ship a 'deal radar' feature with their existing engineering team, they have buyer relationships to monetize within a quarter.",
    moat:
      "Speed + open distribution (MCP, public-source data, marketplace partners). Make the data a commodity Tradeline owns the relationships on.",
  },
  {
    rank: "2",
    name: "Debexpert",
    risk: "high",
    why: "Modern team, active product velocity, willing to ship. Same risk pattern as EverChain.",
    moat: "Become an integration target before they build it (partner first, compete later).",
  },
  {
    rank: "3",
    name: "insideARM / iA Institute",
    risk: "medium",
    why: "Owns the audience. If they hired one data engineer they could ship a basic radar — they probably won't because they're an editorial business culturally.",
    moat: "Outpublish on data; offer them syndication.",
  },
  {
    rank: "4",
    name: "Encore Capital / PRA in-house",
    risk: "medium",
    why: "Build custom tooling internally. Won't sell externally, but they don't need Tradeline.",
    moat: "Target mid-market buyers (10–500 portfolios/yr) who can't justify in-house data engineering.",
  },
  {
    rank: "5",
    name: "Bloomberg",
    risk: "low",
    why: "Will not bother with a vertical this small. Confirmed by the fact they've ignored it for 30 years.",
    moat: "—",
  },
  {
    rank: "6",
    name: "S&P / TransUnion via Argus",
    risk: "low–medium",
    why: "TransUnion now owns the consortium card data. If they pivot to a debt-buyer offering, they have the rawest data.",
    moat:
      "Public-source vs. consortium. Tradeline never asks customers to share data — a positioning advantage with smaller buyers and FCRA-aware counsel.",
  },
];

const WHITE_SPACE = [
  {
    title: "Pre-listing divestiture probability scoring per US bank",
    body: "No incumbent ingests SEC EDGAR + XBRL + CourtListener + Google News into a per-bank divestiture score. Auction platforms react to listings; Garnet writes quarterly trend posts. Tradeline's Radar is unique here.",
    status: "shipped",
  },
  {
    title: "Tape-evaluation copilot with zero-PII architecture",
    body: "Convoke handles media post-sale. Nobody offers a buyer-side, browser-native tape aggregator that produces a bid recommendation in seconds without consumer data exfiltration.",
    status: "shipped",
  },
  {
    title: "Supply-side intelligence-as-a-service",
    body: "Brokers, hypothecation lenders, consumer-finance attorneys, and receivables CPAs currently get deal flow via cold relationships and conferences. No vendor sells filtered alerts as SaaS to those personas. Tradeline's Marketplace is unique.",
    status: "shipped",
  },
  {
    title: "MCP / AI-agent access to deal flow",
    body: "Zero auction platforms expose a programmatic agent interface. With Anthropic Claude and OpenAI agent ecosystems normalizing in 2026, this is a one-year window before it becomes standard.",
    status: "shipped",
  },
  {
    title: "Bonded-buyer sandbox / pre-license onboarding",
    body: "RMAI offers certification; nobody offers a guided onboarding that combines license playbook, bond placement, and a 5-year fund-formation runway in a SaaS surface.",
    status: "shipped",
  },
];

const NEXT_FEATURES = [
  {
    n: "1",
    title: "31-Bank Charge-Off Report — automated weekly PDF + public landing",
    why: "Garnet publishes this quarterly with manual research; Tradeline can publish it weekly from Radar with zero marginal cost. Gates a free email signup that funnels into Solo $99 or Supply-side Starter $499. Content engine is the cheapest CAC channel and the only channel where Tradeline structurally beats Garnet/NLEX.",
    effort: "~2 weeks",
    impact: "Highest CAC leverage. Direct funnel into both revenue lines.",
  },
  {
    n: "2",
    title: "EverChain / Debexpert auction-listing webhook ingestion + matching",
    why: "When a Radar-flagged bank actually lists a portfolio on EverChain or Debexpert, push a high-priority alert to Pro/Team/Enterprise customers ('Your divestiture-flag from 2026-03-15 just listed on EverChain — match score 0.87'). Closes the loop from prediction to action and makes Radar's value falsifiable in real time.",
    effort: "~3 weeks",
    impact: "Turns Radar from a feed into a track record customers can show their LP/credit committee.",
  },
  {
    n: "3",
    title: "Bond + License Concierge — paid referral tier in Setup hub",
    why: "Convert the Setup hub directory into a transactional surface where pre-license users buy bonds and submit license applications through Tradeline-vetted partners. Tradeline takes a referral fee (15–25% on bond commission, $250–500 flat per license filing). Monetizes top-of-funnel, creates lock-in (license artifacts live in Tradeline), and builds proprietary 'who is licensing where' data — which itself becomes a Radar signal layer.",
    effort: "~4 weeks",
    impact: "Monetizes pre-license cohort that's currently free; creates new Radar signal source.",
  },
];

const MARKET_POOLS = [
  {
    pool: "Auction / sale platforms",
    examples: "NLEX, EverChain, DebtX, Debexpert, Garnet AuctionLine",
    sizing: "NLEX alone $250B+ cumulative GMV. ~$20B/yr of US credit-card charge-off sold within first year",
    overlap: "Adjacent — Tradeline feeds them, doesn't replace them",
  },
  {
    pool: "Sell-side advisors",
    examples: "Garnet ($144B managed), DebtX, Mission Capital, Fitzgerald",
    sizing: "Estimated 1–3% on $20B+ annual flow → low-hundreds-of-millions in fees",
    overlap: "Indirect — Tradeline shifts who has timing edge",
  },
  {
    pool: "Industry intelligence / trade press",
    examples: "insideARM, AccountsRecovery, RMAI, ACA, DebtConnection",
    sizing: "Small ($10–50M combined US revenue est.)",
    overlap: "Direct adjacency — outpublish on data, not on relationships",
  },
  {
    pool: "Compliance / registry",
    examples: "Convoke, Global Debt Registry, RMAI cert",
    sizing: "Mid-market vertical SaaS; undisclosed",
    overlap: "Light — partnership > competition",
  },
  {
    pool: "Capital-markets terminals",
    examples: "Bloomberg, S&P Capital IQ, Curinos, Argus",
    sizing: "$30k+/seat. Vertical too small for them to defend",
    overlap: "Pricing-incompatible. Tradeline = 'Bloomberg for the long tail'",
  },
  {
    pool: "Collection software (post-purchase)",
    examples: "TrueAccord, LiveVox, Katabat/Finvi",
    sizing: "$5.98B globally 2025, projected $13.77B by 2034",
    overlap: "Different stage of lifecycle",
  },
];

const PRICING_BENCHMARKS = [
  { tier: "Solo $99/mo", comp: "RMAI $550/yr · insideARM ~$1.5–3k/yr", read: "Slightly underpriced — appropriate for top-of-funnel" },
  { tier: "Pro $299/mo", comp: "RMAI standard $1,250/yr · Debexpert free", read: "In-line" },
  { tier: "Team $899/mo", comp: "S&P Capital IQ Essentials $12k/seat", read: "Aligned. Push to $1,099–1,299 once case studies exist" },
  { tier: "Enterprise custom", comp: "S&P CIQ Advanced $25k · Bloomberg $30k", read: "Anchor at $24k/yr/seat with 3-seat min = $72k/yr" },
  { tier: "Supply-side Starter $499", comp: "RMAI vendor $995/yr · broker CRMs $50–200/seat", read: "Correct" },
  { tier: "Supply-side Pro $1,499", comp: "Legal CLE/compliance feeds $5–15k/yr", read: "Aligned" },
  { tier: "Supply-side Enterprise $4,999", comp: "Curinos / Argus segment data $50k+/yr", read: "Underpriced — add $9,999/mo Fund-of-Funds tier" },
];

const ACQUISITION_CHANNELS = [
  {
    channel: "Content cadence on Radar data",
    cost: "$0 (own infra)",
    notes: "Highest leverage; only channel where Tradeline structurally beats Garnet/NLEX. Publish weekly 31-bank report.",
    priority: "DO FIRST",
  },
  {
    channel: "RMAI Annual Conference",
    cost: "$5–15k sponsorship",
    notes: "Highest single channel for face-to-face. ~1,000+ attendees. Gets vendor table + speaking slot.",
    priority: "Q3 once revenue exists",
  },
  {
    channel: "MCP / Claude / agent registry",
    cost: "$0",
    notes: "Zero auction platforms have done this. List on Anthropic's MCP registry, Claude Marketplace.",
    priority: "DO NOW (already shipped MCP)",
  },
  {
    channel: "LinkedIn outbound to compliance/legal/CPA",
    cost: "Founder time",
    notes: "Underused by debt-sale platforms; high fit for supply-side product.",
    priority: "Continuous",
  },
  {
    channel: "insideARM newsletter sponsorship",
    cost: "$2–10k per post",
    notes: "Cheap relative to RMAI. Sponsored content on charge-off data.",
    priority: "After 3 paying customers",
  },
  {
    channel: "Direct sales to issuers",
    cost: "12–18 month sales cycles",
    notes: "Skip year 1. Incumbents own those rooms via 60+ years of relationships.",
    priority: "AVOID",
  },
];

export default function IntelPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-12 max-w-5xl">
      <header className="mb-12">
        <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Competitive intelligence
        </div>
        <h1 className="mt-4 font-serif text-4xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
          Where Tradeline{" "}
          <span className="italic text-[color:var(--color-accent)]">wins</span>{" "}
          and where it has to.
        </h1>
        <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-3xl">
          Deep landscape mapping of the US debt-buying / receivables-management
          / NPL secondary market: 25+ named competitors, 6 market segments,
          pricing benchmarks, and the moat strategy. Full source-cited document
          at{" "}
          <code className="font-mono text-[13px] text-[color:var(--color-fg)]">
            docs/COMPETITIVE_LANDSCAPE.md
          </code>
          .
        </p>
      </header>

      {/* TOP 3 FINDINGS */}
      <section className="mb-16">
        <SectionHeader tag="01" title="The three findings that matter" />
        <div className="mt-6 space-y-4">
          {TOP_FINDINGS.map((f) => (
            <article key={f.n} className="card-elevated p-7">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-[28px] text-[color:var(--color-accent)] tick">
                  {f.n}
                </span>
                <h3 className="font-serif italic text-[24px] text-[color:var(--color-fg)] tracking-tight">
                  {f.title}
                </h3>
              </div>
              <p className="mt-4 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* THREATS */}
      <section className="mb-16">
        <SectionHeader tag="02" title="Threats — who could replicate, ranked" />
        <p className="mt-3 mb-5 text-[15px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Six potential replicators ranked by structural ability to ship a
          competing deal-radar product, with the moat strategy against each.
        </p>
        <div className="space-y-3">
          {THREATS.map((t) => (
            <article key={t.rank} className="card p-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[20px] text-[color:var(--color-accent)] tick">
                    #{t.rank}
                  </span>
                  <h3 className="text-[18px] font-medium text-[color:var(--color-fg)]">
                    {t.name}
                  </h3>
                </div>
                <span
                  className={`text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded border ${
                    t.risk === "highest"
                      ? "border-[color:var(--color-danger)] text-[color:var(--color-danger)]"
                      : t.risk === "high"
                      ? "border-[color:var(--color-warn)] text-[color:var(--color-warn)]"
                      : t.risk === "medium"
                      ? "border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)]"
                      : "border-[color:var(--color-line)] text-[color:var(--color-fg-faint)]"
                  }`}
                >
                  {t.risk}
                </span>
              </div>
              <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {t.why}
              </p>
              {t.moat !== "—" && (
                <p className="mt-3 text-[13px] text-[color:var(--color-fg)] leading-relaxed border-l-2 border-[color:var(--color-accent-dim)] pl-3">
                  <span className="text-[color:var(--color-accent)] font-medium">
                    Moat:
                  </span>{" "}
                  {t.moat}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* WHITE SPACE */}
      <section className="mb-16">
        <SectionHeader tag="03" title="White space — what nobody else has" />
        <p className="mt-3 mb-5 text-[15px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Five categories of features no incumbent provides. All five are
          shipped or partially shipped in Tradeline today — that&rsquo;s the
          full Year-1 wedge.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WHITE_SPACE.map((w, i) => (
            <article key={i} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif italic text-[18px] text-[color:var(--color-fg)] tracking-tight flex-1">
                  {w.title}
                </h3>
                <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)]">
                  {w.status}
                </span>
              </div>
              <p className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {w.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* MARKET STRUCTURE */}
      <section className="mb-16">
        <SectionHeader tag="04" title="Market structure" />
        <p className="mt-3 mb-5 text-[15px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Six pools. Tradeline competes lightly across all of them but doesn&rsquo;t
          live in any single one — that&rsquo;s the wedge.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[color:var(--color-fg-faint)] text-[10px] tracking-[0.18em] uppercase">
              <tr className="border-b border-[color:var(--color-line)]">
                <th className="px-4 py-3 text-left font-normal">Pool</th>
                <th className="px-4 py-3 text-left font-normal">Examples</th>
                <th className="px-4 py-3 text-left font-normal">Sizing</th>
                <th className="px-4 py-3 text-left font-normal">Overlap</th>
              </tr>
            </thead>
            <tbody>
              {MARKET_POOLS.map((p) => (
                <tr
                  key={p.pool}
                  className="border-b border-[color:var(--color-line)] last:border-b-0 align-top"
                >
                  <td className="px-4 py-3 text-[color:var(--color-accent)] font-medium">
                    {p.pool}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-fg-dim)] leading-relaxed">
                    {p.examples}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-fg-dim)] leading-relaxed">
                    {p.sizing}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-fg)] leading-relaxed">
                    {p.overlap}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PRICING */}
      <section className="mb-16">
        <SectionHeader tag="05" title="Pricing benchmarks" />
        <p className="mt-3 mb-5 text-[15px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Tradeline tiers benchmarked against the closest market comps. Buy-side
          looks defensible; supply-side Enterprise has $5k+/mo of upside once
          social proof exists.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[color:var(--color-fg-faint)] text-[10px] tracking-[0.18em] uppercase">
              <tr className="border-b border-[color:var(--color-line)]">
                <th className="px-4 py-3 text-left font-normal">Tradeline tier</th>
                <th className="px-4 py-3 text-left font-normal">Closest comp</th>
                <th className="px-4 py-3 text-left font-normal">Read</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_BENCHMARKS.map((p) => (
                <tr
                  key={p.tier}
                  className="border-b border-[color:var(--color-line)] last:border-b-0 align-top"
                >
                  <td className="px-4 py-3 text-[color:var(--color-fg)] font-medium">
                    {p.tier}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-fg-dim)]">
                    {p.comp}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-fg)]">
                    {p.read.includes("Underpriced") ? (
                      <span className="text-[color:var(--color-warn)]">{p.read}</span>
                    ) : p.read.includes("In-line") || p.read.includes("Aligned") || p.read.includes("Correct") ? (
                      <span className="text-[color:var(--color-accent)]">{p.read}</span>
                    ) : (
                      p.read
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ACQUISITION CHANNELS */}
      <section className="mb-16">
        <SectionHeader tag="06" title="Customer acquisition — where to spend founder time" />
        <p className="mt-3 mb-5 text-[15px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Eight channels ranked by leverage. Spoiler: weekly content + MCP
          distribution beats anything else for the first $5k MRR.
        </p>
        <div className="space-y-3">
          {ACQUISITION_CHANNELS.map((c) => (
            <article key={c.channel} className="card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1">
                  <h3 className="text-[16px] text-[color:var(--color-fg)] font-medium">
                    {c.channel}
                  </h3>
                  <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {c.notes}
                  </p>
                  <p className="mt-2 text-[11px] text-[color:var(--color-fg-faint)] font-mono">
                    Cost: {c.cost}
                  </p>
                </div>
                <span
                  className={`text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded border whitespace-nowrap ${
                    c.priority.startsWith("DO")
                      ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                      : c.priority === "AVOID"
                      ? "border-[color:var(--color-danger)] text-[color:var(--color-danger)]"
                      : "border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)]"
                  }`}
                >
                  {c.priority}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* NEXT FEATURES */}
      <section className="mb-16">
        <SectionHeader tag="07" title="Next 90 days — three concrete features" />
        <p className="mt-3 mb-5 text-[15px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Ranked by leverage. Each one closes a specific competitive gap or opens
          a structural moat. Estimates are rough.
        </p>
        <div className="space-y-4">
          {NEXT_FEATURES.map((f, i) => (
            <article key={i} className="card-elevated p-7">
              <div className="flex items-baseline gap-4 flex-wrap">
                <span className="font-mono text-[28px] text-[color:var(--color-accent)] tick">
                  {f.n}
                </span>
                <h3 className="font-serif italic text-[22px] text-[color:var(--color-fg)] tracking-tight flex-1">
                  {f.title}
                </h3>
                <span className="text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)] font-mono">
                  {f.effort}
                </span>
              </div>
              <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {f.why}
              </p>
              <p className="mt-3 text-[13px] text-[color:var(--color-fg)] border-l-2 border-[color:var(--color-accent-dim)] pl-3 leading-relaxed">
                <span className="text-[color:var(--color-accent)] font-medium">
                  Why now:
                </span>{" "}
                {f.impact}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-5 card p-5">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            First feature shipped
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            The 31-Bank Charge-Off Report (#1) ships this commit. See{" "}
            <Link
              href="/report"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              /report
            </Link>{" "}
            — the public-facing weekly digest with email signup. CAC channel
            armed and ready.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <p className="text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Full document — 25+ competitor profiles, sources cited inline, 4,000
        words — at{" "}
        <code className="text-[color:var(--color-fg-dim)]">
          docs/COMPETITIVE_LANDSCAPE.md
        </code>
        . Curated 2026-05-07. Re-run quarterly to track market shifts.
      </p>
    </main>
  );
}

function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-[12px] text-[color:var(--color-accent)] tracking-wider">
        {tag}
      </span>
      <span className="font-serif italic text-[26px] md:text-[30px] tracking-tight text-[color:var(--color-fg)]">
        {title}
      </span>
    </div>
  );
}
