import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { SubscribersBoard } from "./_subscribers-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SubscribersPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  return (
    <main className="px-6 md:px-10 lg:px-14 py-12 max-w-5xl">
      <header className="mb-12">
        <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Marketplace · operator dashboard
        </div>
        <h1 className="mt-4 font-serif text-4xl md:text-5xl tracking-tight leading-[1] text-[color:var(--color-fg)]">
          Your{" "}
          <span className="italic text-[color:var(--color-accent)]">
            supply-side
          </span>{" "}
          customers.
        </h1>
        <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-2xl">
          Brokers, lenders, attorneys, and CPAs paying for filtered deal-flow
          alerts. Track who&rsquo;s subscribed, what they want to hear about,
          and what alerts each would have received from today&rsquo;s radar
          snapshot.
        </p>
      </header>

      <div className="mb-8 flex items-center gap-3 flex-wrap">
        <Link href="/app/marketplace" className="btn-secondary">
          See public landing &rarr;
        </Link>
      </div>

      <SubscribersBoard snapshot={snap} />

      <section className="mt-16 card p-6">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          What ships next (Phase 2)
        </div>
        <ul className="mt-4 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>
            <strong className="text-[color:var(--color-fg)]">Real alert delivery.</strong>{" "}
            Today the dashboard <em>previews</em> what alerts each subscriber
            would receive. Phase 2: actual email/Slack/webhook delivery via Resend
            + a queue, with delivery receipts and click tracking.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Postgres-backed multi-tenant.</strong>{" "}
            Move subscribers off localStorage to Supabase Postgres with row-level
            security. Each subscriber gets their own login + preferences UI.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Stripe billing integration.</strong>{" "}
            Auto-bill subscribers monthly. Trial → starter → pro upgrade flows.
            Failed-payment retry + churn alerts.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Custom signal definitions.</strong>{" "}
            Pro+ subscribers describe a signal in plain English; an AI agent
            converts it to a query that runs against the snapshot.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">White-labeled portal.</strong>{" "}
            Enterprise customers get a branded subdomain (e.g.{" "}
            <code className="font-mono text-[12px] text-[color:var(--color-fg)]">
              alerts.garnetcapital.com
            </code>
            ) showing their alerts in their visual identity.
          </li>
        </ul>
      </section>
    </main>
  );
}
