import Link from "next/link";
import { PageIntro } from "../_components/page-intro";
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
      <PageIntro
        eyebrow="Path A · Business"
        title={<>Brokers, lenders, and lawyers who pay for alerts.</>}
        lead={
          <>
            These are the people on the <em>other side</em> from buyers — they want
            to know which banks are about to sell debt so they can broker the deal,
            lend against the debt, or pitch legal services. Each one picks what
            they want to hear about and how often.
          </>
        }
        doNow="Add a subscriber when you sign one. They'll show up in the alert preview below with their next scheduled email."
        howThisWorks={
          <>
            <p>
              Buyers are on /app/customers. <em>Subscribers</em> here are the
              service-side ecosystem: debt brokers, hypothecation lenders,
              collection attorneys, CPAs. They pay for filtered, scheduled deal-flow
              alerts.
            </p>
            <p>
              Right now the dashboard previews what alerts each subscriber would
              receive from today&rsquo;s snapshot. Phase 2 actually delivers them
              via email/Slack with click tracking.
            </p>
          </>
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
