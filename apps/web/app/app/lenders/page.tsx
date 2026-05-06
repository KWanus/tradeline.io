import Link from "next/link";
import { LENDERS, LENDER_TYPE_LABEL } from "@/lib/lenders";

export const dynamic = "force-dynamic";

export default function LendersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
          Hypothecation lenders
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          The capital partners who take seasoned re-performing notes as collateral.
          Once your portfolios are 12+ months performing, this is your menu of
          leverage providers — from commercial banks to specialty credit funds
          to warehouse lines.
        </p>
      </header>

      <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5 mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          Pre-leverage posture
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          You should not approach hypothecation lenders before you have 12+ months
          of clean payment history on a portfolio, an audited collection track
          record, and a stable servicer relationship. Premature outreach burns
          relationships you&rsquo;ll want when you&rsquo;re actually ready. Build
          the portfolio first; the lenders aren&rsquo;t going anywhere.
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
