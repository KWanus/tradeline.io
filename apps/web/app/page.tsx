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
          <div className="h-2 w-2 rounded-full bg-[color:var(--color-accent)] glow" />
          <span className="font-mono text-sm tracking-[0.2em]">TRADELINE</span>
          <span className="hidden sm:inline-block font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-fg-faint)] border border-[color:var(--color-line)] px-2 py-0.5">
            PHASE&nbsp;0&nbsp;·&nbsp;PRE-LAUNCH
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 font-mono text-xs tracking-[0.18em] text-[color:var(--color-fg-dim)]">
          <a href="#radar" className="hover:text-[color:var(--color-fg)] transition">RADAR</a>
          <a href="#pulse" className="hover:text-[color:var(--color-fg)] transition">PULSE</a>
          <a href="#compliance" className="hover:text-[color:var(--color-fg)] transition">COMPLIANCE</a>
          <a href="#access" className="hover:text-[color:var(--color-fg)] transition">ACCESS</a>
        </nav>
      </header>

      {/* live ticker */}
      <div className="relative z-10 border-y border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]">
        <div className="mx-auto max-w-7xl flex items-center gap-6 overflow-x-auto whitespace-nowrap px-6 py-2 font-mono text-[11px] tick">
          <span className="text-[color:var(--color-fg-faint)] tracking-[0.25em]">LIVE&nbsp;·&nbsp;PUBLIC&nbsp;SOURCES</span>
          {TICKER.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className={`uppercase ${TONE_COLORS[t.tone]}`}>{t.tag}</span>
              <span className="text-[color:var(--color-fg-dim)]">{t.line}</span>
            </span>
          ))}
        </div>
      </div>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-20">
        <div className="max-w-4xl">
          <div className="font-mono text-[11px] tracking-[0.3em] text-[color:var(--color-fg-faint)] mb-6">
            INSTITUTIONAL&nbsp;INTELLIGENCE&nbsp;·&nbsp;FOR&nbsp;LICENSED&nbsp;OPERATORS
          </div>
          <h1 className="text-5xl md:text-7xl font-medium leading-[0.95] tracking-tight">
            Find the deal<br />
            before<br />
            <span className="text-[color:var(--color-accent)]">it&rsquo;s a deal.</span>
          </h1>
          <p className="mt-8 text-lg md:text-xl max-w-2xl text-[color:var(--color-fg-dim)] leading-relaxed">
            Tradeline aggregates public divestiture signals, originator health, and portfolio comparables so
            licensed debt buyers source, score, and stay compliant&mdash;without rebuilding the back office.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <a
              href="#access"
              className="font-mono text-xs tracking-[0.2em] uppercase px-6 py-3 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
            >
              Request access
            </a>
            <a
              href="#radar"
              className="font-mono text-xs tracking-[0.2em] uppercase px-6 py-3 border border-[color:var(--color-line-strong)] text-[color:var(--color-fg)] hover:border-[color:var(--color-accent)] transition"
            >
              See the radar
            </a>
            <span className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
              No FCRA-regulated data. No consumer-level scoring. Ever.
            </span>
          </div>
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

      {/* access strip */}
      <section id="access" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="font-mono text-[11px] tracking-[0.3em] text-[color:var(--color-fg-faint)]">FOUNDER&nbsp;PRICING&nbsp;·&nbsp;FIVE&nbsp;SEATS</div>
            <h3 className="mt-3 text-2xl md:text-3xl font-medium tracking-tight">
              Design partner cohort closing this quarter.
            </h3>
            <p className="mt-3 text-[color:var(--color-fg-dim)]">
              Half off forever, weekly office hours, your inbound criteria shape the v1 radar. Licensed buyers and
              collection agencies only.
            </p>
          </div>
          <a
            href="mailto:kwanusmrket@gmail.com?subject=Tradeline%20design%20partner"
            className="font-mono text-xs tracking-[0.2em] uppercase px-6 py-3 bg-[color:var(--color-fg)] text-[color:var(--color-bg)] hover:bg-[color:var(--color-accent)] transition"
          >
            Apply &rarr;
          </a>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-[color:var(--color-line)]">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.18em]">
          <div>© 2026 TRADELINE · ALL TIMES UTC</div>
          <div className="max-w-2xl text-right md:text-left">
            Tradeline is software. Tradeline is not a CRA, debt buyer, or collector. Customers are responsible for
            their own state-level licensing and FDCPA / Reg F compliance.
          </div>
        </div>
      </footer>
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
