import Link from "next/link";
import { PageHeader } from "../_components/page-header";
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
      <PageHeader
        icon={<span aria-hidden>◑</span>}
        title="Subscribers"
        badge={{ label: "Path B", tone: "primary" }}
        tagline="Newsletter readers feeding the supply side — paid and free tiers."
        meta={
          <Link
            href="/app/learn#subscribers"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Subscriber funnel →
          </Link>
        }
      />

      <div className="mb-8 flex items-center gap-3 flex-wrap">
        <Link href="/app/marketplace" className="btn-secondary">
          See public landing &rarr;
        </Link>
      </div>

      <SubscribersBoard snapshot={snap} />

      <section className="mt-16 card p-6">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Coming next (Phase 2)
        </div>
        <ul className="mt-4 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>
            <strong className="text-[color:var(--color-fg)]">Real email delivery.</strong>{" "}
            Today this previews alerts. Phase 2 sends them via Resend, tracks opens
            and clicks.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Subscriber logins.</strong>{" "}
            Each subscriber gets their own page to edit preferences without
            emailing you.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Auto-billing.</strong>{" "}
            Stripe monthly subscription, trial → paid flow, failed-payment retries.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Custom alerts in plain English.</strong>{" "}
            Pro+ subscribers describe what they want (&ldquo;Tier-1 banks with new
            8-K filings&rdquo;) and an AI converts it to a real query.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">White-labeled portal.</strong>{" "}
            Enterprise subscribers get their own branded subdomain showing alerts
            in their visual identity.
          </li>
        </ul>
      </section>
    </main>
  );
}
