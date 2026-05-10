import Link from "next/link";
import { PageIntro } from "../_components/page-intro";
import { CustomersBoard } from "./_customers-board";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-12 max-w-5xl">
      <PageIntro
        eyebrow="Path A · Business"
        title={<>Who&rsquo;s paying you.</>}
        lead={
          <>
            Licensed debt buyers paying monthly for the radar, pipeline, portfolio,
            tape copilot, and AI tutor. Track who&rsquo;s active, who&rsquo;s in
            trial, who might quit, and how close you are to $5k a month.
          </>
        }
        doNow="Customers tagged At-risk need a check-in call this week. Click any card to see their usage."
        howThisWorks={
          <>
            <p>
              Each card is one paying customer. Cards turn yellow (Watch) at 7 days
              of inactivity, red (At-risk) at 14 days. Trial customers auto-expire
              at day 14 — convert them before then or they roll off.
            </p>
            <p>
              Right now, status is set manually. Once you have logins and Stripe
              wired up (Phase 2), it&rsquo;ll auto-fill from real activity and
              billing events.
            </p>
          </>
        }
      />

      <div className="mb-8 flex items-center gap-3 flex-wrap">
        <Link href="/" className="btn-secondary">
          See public landing &rarr;
        </Link>
        <Link href="/app/subscribers" className="btn-secondary">
          Supply-side customers &rarr;
        </Link>
      </div>

      <CustomersBoard />

      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-6">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            What turns a customer At-risk
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>
              <strong className="text-[color:var(--color-fg)]">At-risk</strong> —
              no activity for 14+ days on a paid plan. Email or call this week.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Watch</strong> — 7+
              days inactive, or paying for Pro/Team but barely using it.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Trial</strong> —
              auto-expires at day 14. Convert them or they roll off.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Design partner</strong>{" "}
              — 50% off forever in exchange for a testimonial and roadmap input.
            </li>
          </ul>
        </div>
        <div className="card p-6">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Coming next (Phase 2 — when you have customers)
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>
              <strong className="text-[color:var(--color-fg)]">Logins.</strong>{" "}
              Customer activity fills in automatically — last login, pages used,
              MCP calls.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Stripe billing.</strong>{" "}
              Monthly revenue, active/paused/quit status, trial-end dates, all
              auto-updated from billing events.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Affiliate program.</strong>{" "}
              10% recurring referral fee tracked per referrer, monthly payout.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Auto-alerts.</strong>{" "}
              Email when a customer flips to At-risk so you don&rsquo;t miss it.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
