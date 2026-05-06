import Link from "next/link";
import { LENDERS, LENDER_TYPE_LABEL } from "@/lib/lenders";

export const dynamic = "force-dynamic";

export default function LendersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
          Lenders
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Once your debt portfolio has been paying you for 12+ months, you can use it
          as collateral to borrow more money. These are the 10 main lenders who do that
          for debt buyers in the US.
        </p>
      </header>

      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 mb-4">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What&rsquo;s hypothecation? (and why it matters)
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          Imagine you bought a debt portfolio for $50,000 and a year later it&rsquo;s
          generating $1,500/month in collections. That&rsquo;s a real, performing asset
          — like a rental property. <strong>Hypothecation</strong> is when a lender lends
          you money against that portfolio, treating it like collateral. You typically
          get 30–60% of its current value as a loan.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          Why it matters: you take that borrowed money and buy <em>more</em> debt. Your
          original portfolio still pays you, plus the new portfolio pays you, plus you
          pay back the loan over time. This is how debt buyers scale from one tape to
          dozens — leverage.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          The catch: lenders only do this for portfolios with 12+ months of clean
          payment history (&ldquo;seasoning&rdquo;). They want proof the debtors are
          actually paying before they&rsquo;ll lend against the portfolio.
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

      <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5 mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          Don&rsquo;t approach yet
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Wait until you have 12+ months of clean payment history on a real portfolio,
          an audited collection track record, and a stable servicer relationship.
          Premature outreach burns relationships you&rsquo;ll want when you&rsquo;re
          actually ready. Build the portfolio first; the lenders aren&rsquo;t going
          anywhere.
        </p>
      </div>

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
