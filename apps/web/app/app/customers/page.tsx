export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <header className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          PHASE 2 · NOT BUILT YET
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">Customers</h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl">
          When licensed buyers start paying you for Tradeline, they live here. Org name, primary
          contact, plan, licensed states, MRR, last login, support tickets.
        </p>
      </header>

      <section className="space-y-6">
        <Card title="What this page becomes">
          <ul className="space-y-1.5 list-disc pl-5">
            <li>List of paying customers (Solo / Pro / Team / Enterprise tier)</li>
            <li>License attestation per customer — the states they&rsquo;re actually licensed in</li>
            <li>Plan, MRR, last activity, design-partner status</li>
            <li>Notes, support tickets, founder-call schedule</li>
            <li>Per-customer usage analytics (radar visits, MCP tool calls)</li>
          </ul>
        </Card>

        <Card title="When it ships">
          <p>
            Phase 2 of the roadmap, after the first paying customer. Building it before then is
            spec-fiction; the actual shape will be set by what the first 5 customers ask for. See{" "}
            <code className="font-mono text-[12px] text-[color:var(--color-fg)]">03_PHASE_ROADMAP.md</code>{" "}
            § Weeks 11–12.
          </p>
        </Card>

        <Card title="Where the data lives">
          <p>
            Postgres on Supabase, schema already drafted in{" "}
            <code className="font-mono text-[12px] text-[color:var(--color-fg)]">docs/schema.sql</code>{" "}
            — the <code className="font-mono text-[12px] text-[color:var(--color-fg)]">customers</code>{" "}
            table. Standard B2B SaaS data, no compliance landmines.
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
