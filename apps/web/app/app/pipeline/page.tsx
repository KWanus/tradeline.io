import Link from "next/link";
import { PipelineBoard } from "./_pipeline-board";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Pipeline</h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Every tape you&rsquo;re evaluating. Sourced through Won — track each broker, asset
          class, ask, your bid, and the decision rationale.
        </p>
      </header>

      <PipelineBoard />

      <section className="mt-12 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          How this works in production
        </div>
        <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>
            Today: deals persist on <em>this device only</em> via localStorage. Zero account, zero
            backend — perfect for a solo operator&rsquo;s laptop.
          </li>
          <li>
            Phase 2 (paying customer): same shape, server-backed via Supabase Postgres. Multi-seat,
            shared with your underwriting team.
          </li>
          <li>
            Future: tape-evaluation copilot pre-fills the deal from a CSV upload; the bid
            calculator pre-fills your bid; broker emails auto-attach.
          </li>
        </ul>
        <div className="mt-4">
          <Link
            href="/app/tools/bid-calculator"
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            Open the bid calculator &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}
