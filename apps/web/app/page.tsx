import Link from "next/link";
import { PublicFooter } from "@/app/_components/public-footer";

const TICKER: { tag: string; line: string; tone: "ok" | "warn" | "info" }[] = [
  { tag: "DIV", line: "MIDWEST REGIONAL · CC tape · ~$42M face · 2.7¢", tone: "info" },
  { tag: "10-Q", line: "Top-50 bank · Q charge-offs +18% QoQ · auto", tone: "warn" },
  { tag: "BK",  line: "ED-VA · Ch.7 filings +6.2% MoM · weighted aging 2.1y", tone: "info" },
  { tag: "REG", line: "MD CFR §7-301 · electronic comms guidance updated", tone: "warn" },
  { tag: "DIV", line: "Subprime auto specialty · re-perf tape · 11M face · 14¢", tone: "ok" },
  { tag: "FIL", line: "Mid-cap · 8-K announces $128M divestiture · medical", tone: "ok" },
];

const TONE_COLORS: Record<"ok" | "warn" | "info", string> = {
  ok: "text-[color:var(--color-accent)]",
  warn: "text-[color:var(--color-warn)]",
  info: "text-[color:var(--color-fg-dim)]",
};

export default function Page() {
  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)] overflow-hidden">
      {/* backdrop */}
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      {/* nav */}
      <header className="relative z-10 mx-auto max-w-7xl px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center text-[#1a0c00] font-serif italic text-[18px] shadow-[0_8px_22px_-6px_rgba(236,72,153,0.5)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[20px] text-[color:var(--color-fg)]">
            Tradeline
          </span>
          <span className="hidden sm:inline-block text-[11px] text-[color:var(--color-fg-faint)] border border-[color:var(--color-line)] px-2 py-0.5 rounded-full">
            Beta · accepting design partners
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-[14px] text-[color:var(--color-fg-dim)]">
          <Link href="/report" className="hover:text-[color:var(--color-fg)] transition flex items-center gap-1.5">
            Report <span className="text-[color:var(--color-accent)]">●</span>
          </Link>
          <Link href="/coverage" className="hover:text-[color:var(--color-fg)] transition">Coverage</Link>
          <Link href="/news" className="hover:text-[color:var(--color-fg)] transition">News</Link>
          <Link href="/signals" className="hover:text-[color:var(--color-fg)] transition">Signals</Link>
          <a href="#pricing" className="hover:text-[color:var(--color-fg)] transition">Pricing</a>
          <Link href="/apply" className="hover:text-[color:var(--color-fg)] transition">Apply</Link>
        </nav>
      </header>

      {/* live ticker */}
      <div className="relative z-10 border-y border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)]">
        <div className="mx-auto max-w-7xl flex items-center gap-6 overflow-x-auto whitespace-nowrap px-6 py-2.5 text-[11px] tick">
          <span className="text-[color:var(--color-fg-faint)] tracking-[0.16em] uppercase">Live · public sources</span>
          {TICKER.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className={`font-mono uppercase ${TONE_COLORS[t.tone]}`}>{t.tag}</span>
              <span className="text-[color:var(--color-fg-dim)]">{t.line}</span>
            </span>
          ))}
        </div>
      </div>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-20">
        <div className="max-w-4xl">
          <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-6">
            Institutional intelligence for licensed operators
          </div>
          <h1 className="font-serif text-6xl md:text-8xl tracking-tight leading-[0.92] text-[color:var(--color-fg)]">
            Find the deal<br />
            <span className="italic text-[color:var(--color-fg-dim)]">before</span><br />
            <span className="italic text-[color:var(--color-accent)]">
              it&rsquo;s a deal.
            </span>
          </h1>
          <p className="mt-10 text-lg md:text-xl max-w-2xl text-[color:var(--color-fg-dim)] leading-relaxed">
            Tradeline aggregates public divestiture signals, originator health, and portfolio comparables so
            licensed debt buyers source, score, and stay compliant—without rebuilding the back office.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link href="/report" className="btn-primary">
              Get the weekly report
            </Link>
            <Link href="/coverage" className="btn-secondary">
              See every bank we track &rarr;
            </Link>
            <Link
              href="/apply"
              className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
            >
              Apply for design partner &nearr;
            </Link>
          </div>
          <p className="mt-5 text-[12px] text-[color:var(--color-fg-faint)] leading-relaxed">
            Free weekly report. No paywall. No FCRA-regulated data. No
            consumer-level scoring. Ever. &nbsp;·&nbsp;{" "}
            <Link
              href="/news"
              className="text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
            >
              Recent headlines
            </Link>
            {" "}·{" "}
            <Link
              href="/signals"
              className="text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
            >
              SEC signals
            </Link>
            {" "}·{" "}
            <Link
              href="/feeds"
              className="text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
            >
              JSON APIs
            </Link>
          </p>
        </div>
      </section>

      {/* product bento */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
          {/* deal radar */}
          <div id="radar" className="md:col-span-7 bg-[color:var(--color-bg-1)] p-8 md:p-10 relative shimmer">
            <Eyebrow tag="01" label="DEAL RADAR" />
            <h2 className="mt-4 text-3xl md:text-4xl font-medium tracking-tight">
              Every divestiture, before&nbsp;the&nbsp;press release.
            </h2>
            <p className="mt-4 text-[color:var(--color-fg-dim)] max-w-xl">
              SEC EDGAR + PACER/CourtListener + bank IR + curated news, normalized and deduped. Filter by asset class,
              face value, originator, region. Subscribe by criteria; alerts arrive before the broker memo lands.
            </p>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)] font-mono text-[11px]">
              <Stat k="SOURCES" v="14" />
              <Stat k="DEALS / WK" v="~38" />
              <Stat k="LATENCY" v="&lt; 6h" />
              <Stat k="DEDUPE" v="98.4%" />
            </div>
          </div>

          {/* portfolio pulse */}
          <div id="pulse" className="md:col-span-5 bg-[color:var(--color-bg-1)] p-8 md:p-10">
            <Eyebrow tag="02" label="PORTFOLIO PULSE" />
            <h2 className="mt-4 text-3xl md:text-4xl font-medium tracking-tight">
              Score the tape. <span className="text-[color:var(--color-accent)]">Never the&nbsp;person.</span>
            </h2>
            <p className="mt-4 text-[color:var(--color-fg-dim)]">
              Upload a tape you legally hold. We score the <em>portfolio</em>: originator vintage, charge-off cohort,
              regional macro overlay. Comparables vs anonymized market. PDF or MCP&mdash;your call.
            </p>
            <div className="mt-6 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.18em]">
              FCRA-AWARE&nbsp;·&nbsp;NO&nbsp;CONSUMER&nbsp;FEATURES
            </div>
          </div>

          {/* compliance tracker */}
          <div id="compliance" className="md:col-span-5 bg-[color:var(--color-bg-1)] p-8 md:p-10">
            <Eyebrow tag="03" label="COMPLIANCE TRACKER" />
            <h2 className="mt-4 text-3xl md:text-4xl font-medium tracking-tight">
              50 states. One <span className="text-[color:var(--color-accent)]">honest</span> answer.
            </h2>
            <p className="mt-4 text-[color:var(--color-fg-dim)]">
              License + bond requirements, statute-of-limitations traps, Reg F deltas. RSS-watched at the source so
              you stop ringing your attorney for the easy questions.
            </p>
          </div>

          {/* mcp / agent native */}
          <div className="md:col-span-7 bg-[color:var(--color-bg-1)] p-8 md:p-10">
            <Eyebrow tag="04" label="AGENT-NATIVE" />
            <h2 className="mt-4 text-3xl md:text-4xl font-medium tracking-tight">
              Your <span className="text-[color:var(--color-accent)]">Claude</span> knows the market by Tuesday.
            </h2>
            <p className="mt-4 text-[color:var(--color-fg-dim)] max-w-xl">
              Three MCP servers&mdash;<span className="font-mono text-[color:var(--color-fg)]">deal-radar</span>,&nbsp;
              <span className="font-mono text-[color:var(--color-fg)]">portfolio-pulse</span>,&nbsp;
              <span className="font-mono text-[color:var(--color-fg)]">compliance-tracker</span>&mdash;plug into Claude Desktop, Cursor, or your
              internal agent. Your competitors will still be logging into a dashboard.
            </p>
            <pre className="mt-6 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] p-4 font-mono text-[11px] text-[color:var(--color-fg-dim)] overflow-x-auto">
{`> claude --mcp tradeline.deal-radar
   "find CC tapes 5–50M face, mid-Atlantic, vintage <18mo"

  ✓ 7 deals match · 2 with broker memos posted today
  ✓ originator health: 2 yellow, 1 red
  ✓ subscribed · alerts active`}
            </pre>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="text-center mb-12">
          <div className="text-[12px] tracking-[0.2em] uppercase text-[color:var(--color-fg-faint)]">
            Pricing · paid by the firm
          </div>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl tracking-tight leading-[1.05]">
            One radar.{" "}
            <span className="italic text-gradient-accent">Five ways</span> to buy it.
          </h2>
          <p className="mt-4 text-[color:var(--color-fg-dim)] max-w-2xl mx-auto">
            Monthly subscriptions for buy-side and supply-side firms. Half-off forever for
            design partners signing this quarter.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <PricingTier
            name="Starter"
            price="$99"
            cadence="/mo"
            audience="Solo broker, single asset class"
            features={["Radar (57 banks)", "1 saved filter", "Weekly email digest", "AI tutor (50 msgs/mo)"]}
          />
          <PricingTier
            name="Pro"
            price="$499"
            cadence="/mo"
            audience="Multi-broker firm, 2–3 seats"
            features={["Everything in Starter", "Unlimited filters", "Daily alert digest", "Pipeline + tape copilot", "AI tutor (unlimited)"]}
          />
          <PricingTier
            name="Team"
            price="$1,499"
            cadence="/mo"
            audience="Small lender / law firm"
            featured
            features={["Everything in Pro", "5 seats", "Hypothecation eligibility tracker", "Custom signal rules", "Slack/Teams alerts"]}
          />
          <PricingTier
            name="Enterprise"
            price="$4,999"
            cadence="/mo"
            audience="National broker"
            features={["Everything in Team", "10 seats", "API + MCP server access", "Dedicated CSM", "SLA + data exports"]}
          />
          <PricingTier
            name="Fund of funds"
            price="$9,999"
            cadence="/mo"
            audience="Multi-strategy allocator"
            features={["Everything in Enterprise", "Unlimited seats", "White-labeled portal", "Custom data feeds (hedge fund grade)", "Quarterly strategy review"]}
          />
        </div>
        <p className="mt-6 text-center text-[12px] text-[color:var(--color-fg-faint)]">
          14-day free trial · annual = 2 months free · half off forever for design partners
        </p>
      </section>

      {/* access strip */}
      <section id="access" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-2xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -right-32 -top-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="max-w-xl relative">
            <div className="font-mono text-[11px] tracking-[0.3em] text-[color:var(--color-accent)]">
              FOUNDER&nbsp;PRICING&nbsp;·&nbsp;FIVE&nbsp;SEATS
            </div>
            <h3 className="mt-3 font-serif text-2xl md:text-3xl tracking-tight">
              Design partner cohort closing this quarter.
            </h3>
            <p className="mt-3 text-[color:var(--color-fg-dim)]">
              Half off forever, weekly office hours, your inbound criteria shape the v1 radar.
              Licensed buyers, debt brokers, hypothecation lenders, and collection attorneys only.
            </p>
          </div>
          <Link
            href="/apply"
            className="btn-primary relative"
          >
            Apply for design partner
          </Link>
        </div>
      </section>

      {/* Compliance disclaimer band sits above the shared footer so it stays
          prominent on the marketing landing without bloating the nav. */}
      <section className="relative z-10 border-t border-[color:var(--color-line)]">
        <div className="mx-auto max-w-6xl px-6 py-6 font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed text-center">
          Tradeline is software. Tradeline is not a CRA, debt buyer, or
          collector. Customers are responsible for their own state-level
          licensing and FDCPA / Reg F compliance.
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

function Eyebrow({ tag, label }: { tag: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
      <span className="text-[color:var(--color-accent)]">{tag}</span>
      <span className="h-px w-8 bg-[color:var(--color-line-strong)]" />
      <span>{label}</span>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-[color:var(--color-bg-1)] p-4">
      <div className="text-[color:var(--color-fg-faint)] tracking-[0.2em] text-[10px]">{k}</div>
      <div
        className="mt-2 text-xl text-[color:var(--color-fg)] tick"
        dangerouslySetInnerHTML={{ __html: v }}
      />
    </div>
  );
}

function PricingTier({
  name,
  price,
  cadence,
  audience,
  features,
  featured,
}: {
  name: string;
  price: string;
  cadence: string;
  audience: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 flex flex-col ${
        featured
          ? "border-2 border-transparent"
          : "border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
      }`}
      style={
        featured
          ? {
              background:
                "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            }
          : undefined
      }
    >
      {featured && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full text-[#1a0c00] font-semibold"
          style={{ background: "var(--gradient-primary)" }}
        >
          Most popular
        </span>
      )}
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          {name}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-serif text-3xl text-[color:var(--color-fg)]">{price}</span>
          <span className="text-[12px] text-[color:var(--color-fg-faint)]">{cadence}</span>
        </div>
        <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
          {audience}
        </p>
      </div>
      <ul className="mt-5 space-y-2 flex-1">
        {features.map((f) => (
          <li
            key={f}
            className="text-[12px] text-[color:var(--color-fg-dim)] flex items-start gap-2 leading-snug"
          >
            <span className="text-[color:var(--color-accent)] mt-0.5 shrink-0">→</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href="mailto:kwanusmrket@gmail.com?subject=Tradeline%20pricing%20inquiry"
        className={`mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-medium transition ${
          featured
            ? "text-[#1a0c00] hover:opacity-90"
            : "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg)] hover:border-[color:var(--color-accent)]"
        }`}
        style={featured ? { background: "var(--gradient-primary)" } : undefined}
      >
        {featured ? "Start free trial" : "Choose plan"}
      </a>
    </div>
  );
}
