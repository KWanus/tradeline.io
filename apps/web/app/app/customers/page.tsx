import Link from "next/link";
import { CustomersBoard } from "./_customers-board";

export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-12 max-w-5xl">
      <header className="mb-12">
        <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Buy-side · operator dashboard
        </div>
        <h1 className="mt-4 font-serif text-4xl md:text-5xl tracking-tight leading-[1] text-[color:var(--color-fg)]">
          Your{" "}
          <span className="italic text-[color:var(--color-accent)]">
            licensed-buyer
          </span>{" "}
          customers.
        </h1>
        <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-2xl">
          Licensed debt buyers paying for the radar, pipeline, portfolio, tape
          copilot, and AI tutor. Track who&rsquo;s active, who&rsquo;s in
          trial, who&rsquo;s at risk of churn, and the path to your $5k MRR
          target.
        </p>
      </header>

      <div className="mb-8 flex items-center gap-3 flex-wrap">
        <Link href="/" className="btn-secondary">
          See public landing &rarr;
        </Link>
        <Link href="/app/subscribers" className="btn-secondary">
          Supply-side dashboard &rarr;
        </Link>
      </div>

      <CustomersBoard />

      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-6">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Health-check signals
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>
              <strong className="text-[color:var(--color-fg)]">At-risk</strong>{" "}
              flag fires when last activity is 14+ days old on a paid plan, OR
              when last-week radar visits drop to 0 with non-zero MRR.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Watch</strong>{" "}
              flag fires at 7+ days of inactivity, or low-usage Pro/Team plans.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Trial</strong>{" "}
              status auto-expires at day 14; plan to convert before then.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Design partner</strong>{" "}
              flag = 50% off for life in exchange for testimonial + roadmap input.
            </li>
          </ul>
        </div>
        <div className="card p-6">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Phase 2 — what auto-fills these stats
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>
              <strong className="text-[color:var(--color-fg)]">Auth + tracking.</strong>{" "}
              Once customers log in, last-activity / radar-visits / MCP-calls
              fields populate automatically.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Stripe billing.</strong>{" "}
              MRR, status (active/paused/churned), and trial-end date all
              hydrate from Stripe webhooks.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Affiliate ledger.</strong>{" "}
              The 10%-recurring affiliate program tracked per referrer with
              monthly payout reports.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Health alerts.</strong>{" "}
              Automated email/Slack alert fires when a customer flips to At-risk.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
