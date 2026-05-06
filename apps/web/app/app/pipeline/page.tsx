import Link from "next/link";
import { PipelineBoard } from "./_pipeline-board";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Pipeline</h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Every debt portfolio you&rsquo;re thinking about buying — from the first
          time you saw it, through your bid, to closing or walking away.
        </p>
      </header>

      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What&rsquo;s a deal pipeline?
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          Most active debt buyers are evaluating 5–15 potential deals at once.
          Different brokers, different banks, different asset types, different
          stages. The Pipeline tracks every one — what stage it&rsquo;s in, who you
          got it from, what you&rsquo;re thinking about bidding, what notes you&rsquo;ve
          taken from broker calls.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          The seven stages walk a deal through its life:{" "}
          <strong>Sourced</strong> (you saw it) →{" "}
          <strong>Reviewing</strong> (gathering info) →{" "}
          <strong>Underwriting</strong> (running the numbers) →{" "}
          <strong>Bidding</strong> (you submitted an offer) →{" "}
          <strong>Won / Lost / Walked</strong> (final outcome).
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
