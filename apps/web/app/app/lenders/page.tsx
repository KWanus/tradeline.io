import Link from "next/link";
import { PageIntro } from "../_components/page-intro";
import { LENDERS, LENDER_TYPE_LABEL } from "@/lib/lenders";

export const dynamic = "force-dynamic";

export default function LendersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Ecosystem"
        title={<>Borrow money against the debt you already own.</>}
        lead={
          <>
            Once a portfolio has been paying you for 12+ months, you can use it like
            collateral and borrow another 30–60% of its value. That borrowed money
            buys your next portfolio. This is how debt buyers scale from one deal
            to dozens — leverage. These are the 10 main lenders who do it.
          </>
        }
        doNow="Study this list now. Don't approach anyone until you have 12+ months of clean collections on a real portfolio — they'll ask, and a premature call burns the relationship."
        howThisWorks={
          <>
            <p>
              Say you bought a $50k portfolio and a year later it&rsquo;s pulling
              in $1,500/month. That&rsquo;s a real performing asset — like a rental
              property. A lender will hand you a loan against it (this is called{" "}
              <em>hypothecation</em>) — usually 30–60% of current value.
            </p>
            <p>
              You take that loan, buy another portfolio. The original keeps paying
              you. The new one starts paying you. You pay the loan back over time.
              Now you own two portfolios instead of one. Do this a few times and
              you&rsquo;re scaling.
            </p>
            <p>
              Lenders only lend on portfolios with 12+ months of clean payment
              history (&ldquo;seasoning&rdquo;). They want proof the debtors are
              actually paying before they&rsquo;ll lend you the next $25k.
            </p>
          </>
        }
      />

      <section className="space-y-3">
        {LENDERS.map((l) => (
          <article
            key={l.shortName}
            className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 hover:border-[color:var(--color-line-strong)] transition"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-medium text-[color:var(--color-fg)]">{l.name}</h2>
                <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                  {LENDER_TYPE_LABEL[l.type]}
                </div>
              </div>
              {l.url && (
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                >
                  Visit &rarr;
                </a>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Collateral focus">
                <div className="flex flex-wrap gap-1.5">
                  {l.collateralFocus.map((c) => (
                    <span
                      key={c}
                      className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </Field>
              <Field label="Advance rate">{l.advanceRateRange}</Field>
              <Field label="Typical ticket">{l.ticketRange}</Field>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Min seasoning">{l.minSeasoningMonths} months</Field>
              <Field label="How buyers reach them">{l.contactPath}</Field>
            </div>

            <div className="mt-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              {l.notes}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            What lenders actually evaluate
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>12+ months of clean payment history on the collateral pool</li>
            <li>Servicer audit trail (monthly remittance reports, reconciled)</li>
            <li>Asset class quality (secured beats unsecured)</li>
            <li>Geographic and originator diversification</li>
            <li>Your operating history (3+ closed deals as a baseline)</li>
            <li>Bond + license footprint matching collection states</li>
          </ul>
        </div>
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            What kills a hypothecation conversation
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>Tape under 6 months seasoned</li>
            <li>Single-state or single-originator concentration</li>
            <li>Servicer with a regulatory consent decree</li>
            <li>Asset class outside the lender&rsquo;s collateral focus</li>
            <li>Audited collection history that doesn&rsquo;t match unaudited claims</li>
            <li>Open CFPB / state AG investigation against you</li>
          </ul>
        </div>
      </section>

      <div className="mt-10 flex items-center gap-3 flex-wrap">
        <Link
          href="/app/portfolio"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Check your portfolio&rsquo;s hypothecation eligibility &rarr;
        </Link>
        <Link
          href="/app/capital"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Capital allocation playbook &rarr;
        </Link>
      </div>

      <p className="mt-8 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Curated as of 2026-05-06. Names + URLs are public; advance rates and
        ticket sizes are approximations and will drift with market conditions.
        Verify before approaching.
      </p>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className="mt-1.5 text-[13px] text-[color:var(--color-fg)]">{children}</div>
    </div>
  );
}
