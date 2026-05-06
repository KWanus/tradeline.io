import Link from "next/link";
import { PortfolioBoard } from "./_portfolio-board";

export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
          My portfolio
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          The debt portfolios you actually own. How much you paid for each, how
          much they&rsquo;re collecting, when they&rsquo;ll qualify for borrowing
          against (hypothecation).
        </p>
      </header>

      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What does it mean to &ldquo;own&rdquo; debt?
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          When you buy a debt portfolio (a tape), you&rsquo;re buying the legal right
          to collect from those debtors. The bank that originally lent the money is
          no longer involved — you are. Your servicer collects on your behalf;
          payments come to you (minus the servicer&rsquo;s fee).
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          Three numbers matter most for each portfolio:
        </p>
        <ul className="mt-2 space-y-1 list-disc pl-5 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          <li>
            <strong>Face value</strong> — total dollars debtors owe (e.g. $1M)
          </li>
          <li>
            <strong>Purchase price</strong> — what you paid for it (e.g. $50k —
            5¢/$ of face)
          </li>
          <li>
            <strong>Collected to date</strong> — what your servicer has actually
            recovered (e.g. $80k after 18 months — already profit territory)
          </li>
        </ul>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          Once a portfolio has been paying you reliably for 12+ months, it qualifies
          for <strong>hypothecation</strong> — borrowing against it. The card for
          each portfolio shows when it crosses that threshold and how much you could
          borrow.
        </p>
        <p className="mt-3 text-[13px] text-[color:var(--color-fg-faint)] leading-relaxed">
          New to this? Read{" "}
          <Link
            href="/app/learn"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            How this works
          </Link>{" "}
          first.
        </p>
      </div>

      <PortfolioBoard />

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Hypothecation thresholds (heuristic)
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] font-mono">
            <li>Credit card · 12 months seasoned · ~35% advance rate</li>
            <li>Auto · 9 months · ~50% advance</li>
            <li>Junior mortgage · 12 months · ~65% advance</li>
            <li>Medical · 18 months · ~25% advance</li>
            <li>Tax lien · 6 months · ~60% advance</li>
            <li>Commercial · 12 months · ~45% advance</li>
            <li>Specialty · 18 months · ~30% advance</li>
          </ul>
          <p className="mt-3 text-[12px] text-[color:var(--color-fg-faint)] leading-relaxed">
            Real lender terms vary. Use these as a planning baseline, not a
            commitment.
          </p>
        </div>
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Compliance posture
          </div>
          <p className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            This page stores <em>portfolio-level aggregates</em> only — face value,
            cost, performing balance, collected dollars, servicer name. Individual
            account names, addresses, and account numbers from your tapes never
            enter this view; those live only in the encrypted tape file with your
            servicer.
          </p>
          <p className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Today this is single-device localStorage. Phase 2 swaps to Supabase
            Postgres with row-level security so multi-seat teams can collaborate
            without leaking data across customers.
          </p>
        </div>
      </section>

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <Link
          href="/app/capital"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Capital allocation playbook &rarr;
        </Link>
        <Link
          href="/app/tools/tape"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Tape evaluation copilot &rarr;
        </Link>
      </div>
    </main>
  );
}
