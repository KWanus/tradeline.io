import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { PublicFooter } from "@/app/_components/public-footer";
import { aboutFaqLd, jsonLdScript } from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "About · Tradeline",
  description:
    "Tradeline is an operations workbase + weekly Charge-Off Report built from public-source filings. No consumer data, no FCRA exposure, no paywall on the report. Here's how it works and who built it.",
};

export default async function AboutPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const bankCount = snap.originators.length || 57;
  const signalCount = snap.summary?.sec_signals_total || 0;
  const filingCount = snap.summary?.filings_total || 0;

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(aboutFaqLd())}
      />
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px]">Tradeline</span>
        </Link>
        <Link
          href="/report"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Subscribe &rarr;
        </Link>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          About
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          Find the deal{" "}
          <span className="italic text-gradient-accent">before it&rsquo;s a deal.</span>
        </h1>
        <p className="mt-6 text-[18px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Tradeline is a research and operations workbase for the
          non-performing-loan ecosystem — buyers, brokers, hypothecation
          lenders, consumer-finance attorneys, receivables CPAs. It pairs a
          public weekly Charge-Off Report with an in-app workbase that handles
          everything from outreach to bid composition to compliance tracking.
        </p>

        <section className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)] rounded-lg overflow-hidden">
          <Stat label="Banks scored" value={bankCount.toString()} accent />
          <Stat label="Signals indexed" value={signalCount.toLocaleString()} />
          <Stat label="SEC filings ingested" value={filingCount.toLocaleString()} />
        </section>

        <Section title="What Tradeline does">
          <p>
            Banks charge off loans every quarter, but most of those charge-offs
            don&rsquo;t show up on auction platforms (NLEX, EverChain, Debexpert,
            Garnet) until weeks or months later. The signal exists much earlier
            — in 10-Q footnotes, 8-K dispositions, XBRL charge-off
            concepts, and news mentions of portfolio reviews. Tradeline ingests
            those public-source signals every 6 hours, scores each bank on
            divestiture probability, and tells you which names to watch this
            week.
          </p>
          <p>
            The workbase handles the rest of the deal lifecycle: profile,
            broker outreach, reply classification, bid composition, pipeline,
            portfolio, hypothecation pitching, state licensing, fund-formation
            readiness.
          </p>
          <p>
            <Link
              href="/app/learn"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              How this whole business works &rarr;
            </Link>
          </p>
        </Section>

        <Section title="How the radar works">
          <p>The scoring model has four inputs per bank:</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              <strong>SEC XBRL charge-off cohort velocity</strong> — quarter-
              over-quarter and year-over-year deltas on the standard charge-off
              concepts.
            </li>
            <li>
              <strong>8-K items 2.01 + 2.06 + 7.01 keyword matches</strong> —
              dispositions, material impairments, and Reg FD events with NPL
              keywords (charge-off, non-performing, portfolio sale, divestiture,
              loan loss).
            </li>
            <li>
              <strong>News-feed matches</strong> — filtered to the bank&rsquo;s
              tracked CIK, scored by recency and source quality.
            </li>
            <li>
              <strong>Court docket signals</strong> — bankruptcy filings against
              the originator, FDIC enforcement actions, state AG complaints.
            </li>
          </ol>
          <p>
            Each input is weighted by recency and confidence, then aggregated
            into a 0.0–1.0 score per bank per week. Strong (≥0.7), Watching
            (0.5–0.7), Quiet (&lt;0.5).
          </p>
          <p>
            <Link
              href="/app/intel/track-record"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              See the prediction-vs-reality log &rarr;
            </Link>
          </p>
        </Section>

        <Section title="What we touch — and don't">
          <div className="space-y-3">
            <div className="rounded-lg border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] p-4">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-success)]">
                Touched
              </div>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-[14px] text-[color:var(--color-fg)]">
                <li>SEC EDGAR public filings (10-K/Q, 8-K, S-1, etc.)</li>
                <li>XBRL standard accounting concepts (charge-off, allowance, NPL ratio)</li>
                <li>Google News matched to bank CIK</li>
                <li>CourtListener federal-court dockets</li>
                <li>Your email + name + reader-type when you subscribe to /report</li>
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] p-4">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-danger)]">
                Never touched
              </div>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-[14px] text-[color:var(--color-fg)]">
                <li>Consumer or debtor names, addresses, phones, SSNs, account numbers</li>
                <li>FCRA-regulated credit reports</li>
                <li>Tape contents — the tape copilot parses in your browser; row-level data never reaches our servers</li>
                <li>Your workbase state (pipeline, outreach log, watchlist) — all localStorage, all on your device</li>
                <li>Third-party tracking cookies / advertising pixels</li>
              </ul>
            </div>
          </div>
          <p>
            This architecture is deliberate: it keeps Tradeline outside FCRA
            scope and outside the consumer-data perimeter that creates
            compliance risk for licensed buyers.
          </p>
        </Section>

        <Section title="Who built this">
          <p>
            Tradeline is built by a solo founder in the Mid-Atlantic, bootstrapping
            without outside capital. The roadmap is shaped by what real licensed
            buyers, brokers, and lenders ask for — design-partner pricing exists
            for the first cohort of customers willing to give feedback.
          </p>
          <p>
            The codebase is{" "}
            <a
              href="https://github.com/KWanus/tradeline.io"
              target="_blank"
              rel="noreferrer"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              public on GitHub
            </a>
            . The radar workers are Python; the workbase is Next.js + Tailwind.
            All radar data is committed to a separate{" "}
            <code className="font-mono text-[13px] text-[color:var(--color-fg)]">data</code> branch by a
            GitHub Actions cron that runs every 6 hours.
          </p>
        </Section>

        <Section title="Pricing">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Weekly report.</strong> Free. No paywall, no credit card.
              Subscribe at{" "}
              <Link
                href="/report"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                /report
              </Link>{" "}
              and the next Monday issue ships to your inbox.
            </li>
            <li>
              <strong>Workbase (in-app).</strong> Currently free for design
              partners — operators willing to give product feedback in exchange
              for early access and a permanent discount. See{" "}
              <Link
                href="/"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                pricing tiers
              </Link>
              .
            </li>
            <li>
              <strong>Supply-side intelligence (brokers, lenders, attorneys).</strong>{" "}
              Filtered, scheduled deal-flow alerts. Pricing at{" "}
              <Link
                href="/app/marketplace"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                /app/marketplace
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section title="Disclaimer">
          <p>
            Tradeline is software. Tradeline is not a CRA, debt buyer, or
            collector. Everything published here is educational content built
            from public-source data — not legal, financial, or investment
            advice. Buying or collecting consumer debt is regulated; get a
            consumer-finance attorney before acting. See{" "}
            <Link
              href="/terms"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              terms
            </Link>{" "}
            for the rest.
          </p>
        </Section>

        <section className="mt-14 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-8 text-center">
          <h2 className="font-serif text-2xl tracking-tight">
            Get the Charge-Off Report every Monday.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto">
            Free. Unsubscribe in one click. {bankCount} banks scored. Built so
            you walk into your next broker call knowing what they&rsquo;re
            about to pitch.
          </p>
          <div className="mt-5">
            <Link
              href="/report"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#1a0c00] hover:opacity-90 transition inline-block"
              style={{ background: "var(--gradient-primary)" }}
            >
              Subscribe &rarr;
            </Link>
          </div>
        </section>
      </article>

      <PublicFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-serif italic text-2xl md:text-3xl tracking-tight text-[color:var(--color-fg)] mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[color:var(--color-bg-1)] px-5 py-4">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl ${
          accent
            ? "text-[color:var(--color-accent)]"
            : "text-[color:var(--color-fg)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
