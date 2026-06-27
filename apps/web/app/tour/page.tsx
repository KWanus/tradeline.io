import Link from "next/link";

import { PublicFooter } from "@/app/_components/public-footer";

export const dynamic = "force-static";

export const metadata = {
  title: "How Tradeline works — a 2-minute tour",
  description:
    "See how Tradeline sources non-performing-loan deals from public data, scores them, finds the right contact, and drafts compliant outreach — in four screens.",
};

/**
 * Public, link-from-cold-email visual walkthrough. Each step pairs a plain
 * explanation with a framed "screen" mock that recreates the real product
 * panel using the same design tokens — so a prospect sees what they're buying
 * before they ever log in. Linked as TOUR_URL by the growth engine's emails.
 */

type Step = {
  n: string;
  kicker: string;
  title: string;
  body: string;
  screen: React.ReactNode;
};

export default function TourPage() {
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)]">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-[color:var(--color-line)]">
        <div className="mx-auto max-w-5xl px-6 pt-16 pb-12">
          <Link
            href="/"
            className="font-mono text-[10px] tracking-[0.24em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)]"
          >
            ← Tradeline
          </Link>
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--color-line)] font-mono text-[10px] tracking-[0.2em] uppercase text-[color:var(--color-fg-dim)]">
            <span aria-hidden>●</span> 2-minute tour
          </div>
          <h1 className="mt-5 text-[34px] md:text-[46px] font-semibold tracking-tight text-[color:var(--color-fg)] leading-[1.05]">
            How a debt buyer finds the next
            <br className="hidden md:block" /> portfolio with Tradeline.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] md:text-[17px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Tradeline turns public filings into a working deal pipeline. It
            watches who is shedding non-performing loans, scores what they hold,
            finds the right person to ask, and drafts a compliant intro — so you
            spend your time bidding, not hunting. Here it is in four screens.
          </p>
          <div className="mt-7 flex items-center gap-3 flex-wrap">
            <Link href="/#pricing" className="btn-primary">
              Start a free trial →
            </Link>
            <Link
              href="/"
              className="px-4 py-2 rounded-full text-[13px] border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              See the live deal radar
            </Link>
          </div>
        </div>
      </header>

      {/* Steps */}
      <main className="mx-auto max-w-5xl px-6 py-16 space-y-20">
        {STEPS.map((step, i) => (
          <section
            key={step.n}
            className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center ${
              i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-accent-soft)] font-mono text-[14px] text-[color:var(--color-accent)]">
                  {step.n}
                </span>
                <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
                  {step.kicker}
                </span>
              </div>
              <h2 className="mt-4 text-[24px] md:text-[28px] font-semibold tracking-tight text-[color:var(--color-fg)]">
                {step.title}
              </h2>
              <p className="mt-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {step.body}
              </p>
            </div>
            <ScreenFrame>{step.screen}</ScreenFrame>
          </section>
        ))}

        {/* Closing CTA */}
        <section className="rounded-3xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-10 text-center">
          <h2 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-[color:var(--color-fg)]">
            Your next deal is already in a public filing.
          </h2>
          <p className="mt-3 mx-auto max-w-xl text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Tradeline reads them so you don&apos;t have to. Start free, connect
            your profile, and let the radar surface buyers and sellers the day
            they move.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link href="/#pricing" className="btn-primary">
              See plans &amp; start free →
            </Link>
            <Link
              href="/"
              className="px-4 py-2 rounded-full text-[13px] border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              Back to homepage
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

/** A browser-chrome frame around each mock screen. */
function ScreenFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)]">
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-line-strong)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-line-strong)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-line-strong)]" />
        <span className="ml-3 font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-fg-faint)]">
          app.tradeline.io
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ---- Mock screens (built from real product copy, no external images) ---- */

function RadarScreen() {
  const rows = [
    { t: "WAL", n: "Western Alliance", s: "Strong", v: "Charge-offs +306% YoY", tone: "warn" },
    { t: "FLG", n: "Flagstar", s: "Watching", v: "8-K · $128M divestiture", tone: "ok" },
    { t: "DIV", n: "Midwest Regional", s: "Strong", v: "CC tape · ~$42M · 2.7¢", tone: "warn" },
    { t: "CFR", n: "Coastal FCU", s: "Quiet", v: "Delinquency +1.1% QoQ", tone: "dim" },
  ];
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[color:var(--color-fg-faint)] mb-3">
        Deal radar · live
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.t}
            className="flex items-center gap-3 rounded-lg border border-[color:var(--color-line)] px-3 py-2.5"
          >
            <span className="font-mono text-[12px] font-semibold text-[color:var(--color-fg)] w-10">
              {r.t}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-[color:var(--color-fg)] truncate">{r.n}</div>
              <div className="text-[11px] text-[color:var(--color-fg-dim)] truncate">{r.v}</div>
            </div>
            <span
              className={`font-mono text-[10px] tracking-[0.14em] uppercase ${
                r.tone === "warn"
                  ? "text-[color:var(--color-warn)]"
                  : r.tone === "ok"
                    ? "text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-fg-faint)]"
              }`}
            >
              {r.s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreScreen() {
  const bars = [
    { label: "Charge-off acceleration", pct: 86 },
    { label: "Asset-class fit", pct: 72 },
    { label: "Disposition likelihood", pct: 64 },
    { label: "Recovery headroom", pct: 49 },
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[color:var(--color-fg-faint)]">
          Portfolio score · WAL
        </div>
        <div className="text-[22px] font-semibold text-[color:var(--color-accent)]">
          78<span className="text-[12px] text-[color:var(--color-fg-faint)]">/100</span>
        </div>
      </div>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-[11px] text-[color:var(--color-fg-dim)] mb-1">
              <span>{b.label}</span>
              <span className="font-mono">{b.pct}</span>
            </div>
            <div className="h-2 rounded-full bg-[color:var(--color-bg-soft)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[color:var(--color-accent)]"
                style={{ width: `${b.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactScreen() {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[color:var(--color-fg-faint)] mb-3">
        Who to ask · special assets
      </div>
      <div className="rounded-lg border border-[color:var(--color-line)] p-4">
        <div className="text-[15px] font-semibold text-[color:var(--color-fg)]">
          J. Marin
        </div>
        <div className="text-[12px] text-[color:var(--color-fg-dim)]">
          SVP, Special Assets &amp; Loan Workout
        </div>
        <div className="mt-3 space-y-1.5 font-mono text-[12px] text-[color:var(--color-fg-dim)]">
          <div>✉ jmarin@westernalliance.com</div>
          <div>☎ (602) 555-0148</div>
          <div className="text-[color:var(--color-accent)]">in/ linkedin.com/in/…</div>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-success)]">
          ● resolved · confidence 0.85
        </div>
      </div>
    </div>
  );
}

function OutreachScreen() {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[color:var(--color-fg-faint)] mb-3">
        Compliant draft · ready to send
      </div>
      <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4">
        <div className="text-[13px] font-semibold text-[color:var(--color-fg)]">
          Inquiry list — charged-off auto, AZ-licensed buyer
        </div>
        <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Hi J. — we&apos;re an AZ-licensed buyer focused on charged-off auto,
          $1–5M tapes, bonded and servicer-backed. Your recent workout volume
          looks like a fit. Could we be added to your inquiry list, or grab one
          small test tape?
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-[color:var(--color-accent)] text-[#0a0c14] text-[11px] font-semibold">
            Send
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-success)]">
            FCRA / Reg F checked
          </span>
        </div>
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  {
    n: "1",
    kicker: "Sourcing",
    title: "The radar watches who's selling — in real time.",
    body: "Tradeline reads SEC 8-Ks, FDIC and NCUA call reports, and bankruptcy dockets as they post. When a bank's charge-offs spike or it announces a divestiture, it surfaces on your radar with the signal that put it there — no scraping, no paid feed, just public data read well.",
    screen: <RadarScreen />,
  },
  {
    n: "2",
    kicker: "Scoring",
    title: "Every name gets scored before you spend a minute on it.",
    body: "Each institution is scored on charge-off acceleration, how well its book fits your asset class, how likely it is to dispose, and recovery headroom. You work the 78s, not the 12s — so your hours go to portfolios that actually clear.",
    screen: <ScoreScreen />,
  },
  {
    n: "3",
    kicker: "Contacts",
    title: "It finds the one person who can say yes.",
    body: "The contact resolver locates the special-assets, workout, or recovery lead at the institution — name, work email, phone, LinkedIn — from public sources, with a confidence score. No more guessing at info@ or cold-calling the switchboard.",
    screen: <ContactScreen />,
  },
  {
    n: "4",
    kicker: "Outreach",
    title: "And drafts the intro — compliant, in your voice.",
    body: "Tradeline writes the first email for you: your license, your bond, your servicer, your ticket range, matched to the institution and run through an FCRA / Reg F check. You read it, tweak a line, and send. Replies route straight to your inbox.",
    screen: <OutreachScreen />,
  },
];
