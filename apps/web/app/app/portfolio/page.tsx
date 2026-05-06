export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <header className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          YEAR 2 · POST-LICENSE
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">My portfolio</h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl">
          When you&rsquo;re a licensed buyer servicing your own debt, this is your operational
          dashboard. How much you own, who&rsquo;s paying, recovery rate, contract status. Servicer
          reports, monthly cash flow, hypothecation eligibility.
        </p>
      </header>

      <section className="space-y-6">
        <Card title="What this page becomes">
          <ul className="space-y-1.5 list-disc pl-5">
            <li>Each portfolio you own — purchase price, face value, asset class, vintage, seller</li>
            <li>Current performing balance vs original</li>
            <li>Aggregate collection rate (no consumer-level rows surfaced here)</li>
            <li>Servicer (third-party) status, monthly remittances, fee schedule</li>
            <li>
              Hypothecation tracker — months of seasoning, advance-rate eligibility, lender
              relationships
            </li>
            <li>Contracts (purchase, servicing, hypothecation) stored as encrypted attachments</li>
          </ul>
        </Card>

        <Card title="When it ships">
          <p>
            Year 2, after you hold a state debt-buyer license, are bonded, and have purchased your
            first portfolio. Per <code className="font-mono text-[12px] text-[color:var(--color-fg)]">03_PHASE_ROADMAP.md</code>{" "}
            Phase 4–5. Until then, this page stays a placeholder so you don&rsquo;t accidentally
            start storing operational data without the licensing structure to support it.
          </p>
        </Card>

        <Card title="What it stores · what it never stores">
          <p className="mb-3">
            <span className="text-[color:var(--color-accent)]">Stores:</span> portfolio-level
            aggregates, contracts, servicer reports, your operational P&amp;L. This is your business&rsquo;s
            books — entirely lawful for a licensed buyer to keep.
          </p>
          <p>
            <span className="text-[color:var(--color-warn)]">Never stores in this view:</span>{" "}
            individual debtor names, addresses, phone numbers, or payment history surfaced as a
            ranked list. That data lives only in the encrypted tape file with your servicer (or in
            a separate, RLS-isolated, audited{" "}
            <code className="font-mono text-[12px] text-[color:var(--color-fg)]">customer_tapes</code>{" "}
            table — schema already drafted), is never aggregated across buyers, and is never sold
            or surfaced as a profile. That&rsquo;s the line between an operating debt buyer (legal)
            and a Consumer Reporting Agency (federally regulated, separate registration).
          </p>
        </Card>

        <Card title="Why we&rsquo;re separating this from the radar">
          <p>
            The radar (Today / Banks / News) is <em>market intelligence</em> — public-source data
            about other people&rsquo;s books. It&rsquo;s the same product whether you&rsquo;re
            licensed or not, and the same product Tradeline sells to other licensed buyers.
          </p>
          <p className="mt-2">
            The portfolio dashboard is <em>your private operations</em> — only your data, only
            visible to you. Different threat model, different storage (encrypted at rest with
            customer-managed keys), different audit trail.
          </p>
        </Card>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {title}
      </div>
      <div className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}
