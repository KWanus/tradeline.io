import Link from "next/link";
import { PageIntro } from "../_components/page-intro";
import { PortfolioBoard } from "./_portfolio-board";
import { RemittanceTracker } from "./_remittance-tracker";

export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Workflow"
        title={<>The debt you actually own.</>}
        lead={
          <>
            After you buy a portfolio, log it here. Track how much you paid, how much
            it&rsquo;s collecting, and when you can borrow against it to buy your next
            one.
          </>
        }
        doNow="After your first close, click + Add portfolio and enter face value, what you paid, and your servicer."
        howThisWorks={
          <>
            <p>
              When you buy a portfolio (a &ldquo;tape&rdquo;), you&rsquo;re buying the
              legal right to collect from the people who owe the money. The bank
              that originally lent it is out — you&rsquo;re in. Your servicer does
              the actual collection work and takes a fee.
            </p>
            <p>Three numbers matter for each portfolio:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Face value</strong> — total dollars debtors owe (e.g. $1M).
              </li>
              <li>
                <strong>Purchase price</strong> — what you paid (e.g. $50k = 5¢ per
                dollar of face).
              </li>
              <li>
                <strong>Collected to date</strong> — what your servicer has actually
                pulled in.
              </li>
            </ul>
            <p>
              Once a portfolio has paid you reliably for 12+ months, you can borrow
              against it (this is called <em>hypothecation</em>). Each card shows
              when it crosses that line and how much you could borrow.
            </p>
          </>
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
