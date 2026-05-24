import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { PortfolioBoard } from "./_portfolio-board";
import { RemittanceTracker } from "./_remittance-tracker";

export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>◉</span>}
        title="Portfolio"
        badge={{ label: "Live", tone: "success" }}
        tagline="Owned paper. What you're collecting on this month, lifetime, and by vintage."
        meta={
          <Link
            href="/app/learn#portfolio"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Portfolio math →
          </Link>
        }
      />

      <PortfolioBoard />
      <RemittanceTracker />

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-fg-faint)] uppercase">
            When can I borrow against a portfolio?
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)]">
            Rough rules of thumb — real lender terms vary.
          </p>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] font-mono">
            <li>Credit card · pays 12 months · borrow ~35%</li>
            <li>Auto · pays 9 months · borrow ~50%</li>
            <li>Junior mortgage · pays 12 months · borrow ~65%</li>
            <li>Medical · pays 18 months · borrow ~25%</li>
            <li>Tax lien · pays 6 months · borrow ~60%</li>
            <li>Commercial · pays 12 months · borrow ~45%</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-fg-faint)] uppercase">
            What this page does NOT store
          </div>
          <p className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Only the totals — face value, what you paid, what&rsquo;s been
            collected, your servicer&rsquo;s name. Individual debtor names,
            addresses, and account numbers never enter this view. Those live only
            in the encrypted tape file with your servicer.
          </p>
        </div>
      </section>

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <Link
          href="/app/capital"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Decide where to deploy cash &rarr;
        </Link>
        <Link
          href="/app/tools/tape"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Score a new tape before bidding &rarr;
        </Link>
      </div>
    </main>
  );
}
