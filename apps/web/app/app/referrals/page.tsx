import Link from "next/link";
import { PageIntro } from "../_components/page-intro";
import { LENDER_PROGRAMS, PRODUCT_LABEL } from "@/lib/referrals";
import { ReferralDesk } from "./_referral-desk";

export const dynamic = "force-dynamic";

export default function ReferralsPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Revenue line"
        title={<>Get paid when a bank funds a business.</>}
        lead={
          <>
            Debt-buying is your asset business — slow to build, capital-hungry.
            This is the cash-flow business that runs alongside it: you introduce
            a real business that needs financing to a lender partner, the lender
            funds it, and you collect a referral commission out of{" "}
            <em>their</em> gain. No capital at risk, no waiting on collections.
          </>
        }
        doNow="Log one business you already know that could use money — a contractor, a shop owner, anyone. The desk scores it and tells you which lender to send it to."
        howThisWorks={
          <>
            <p>
              Every lender below runs a referral or partner program. You sign up
              free, you get a tracked link or a submission contact. When you send
              them a business that funds, they pay you a cut of the loan — that&rsquo;s
              the whole model.
            </p>
            <p>
              You are <strong>not</strong> the lender and you never pull anyone&rsquo;s
              credit. You&rsquo;re the introduction. That keeps this clean — no
              licensing of your own, no FCRA exposure, no capital. The one rule:
              every business and every number you submit has to be real. Inventing
              a borrower or padding its revenue to force a deal through is loan
              fraud — the desk only works with genuine leads.
            </p>
            <p>
              Where leads come from: the businesses around your debt-buying work,
              your customers and subscribers, local owners you already know.
              One funded SBA deal can pay more than a month of collections.
            </p>
          </>
        }
      />

      <ReferralDesk />

      {/* Lender partner directory */}
      <section className="mt-14">
        <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
          Lender partner programs
        </div>
        <h2 className="mt-2 font-serif text-3xl tracking-tight text-[color:var(--color-fg)]">
          The eight programs the desk routes to.
        </h2>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Sign up for the top three first — Lendio, Bluevine, and a fast term
          lender cover most of what walks in the door. Add the rest as your lead
          flow grows.
        </p>

        <div className="mt-5 space-y-3">
          {LENDER_PROGRAMS.map((p) => (
            <article
              key={p.shortName}
              className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5"
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-3 flex-wrap">
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif text-lg tracking-tight text-[color:var(--color-fg)] hover:text-[color:var(--color-accent)] transition"
                    >
                      {p.name}
                    </a>
                  ) : (
                    <span className="font-serif text-lg tracking-tight text-[color:var(--color-fg)]">
                      {p.name}
                    </span>
                  )}
                  <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)] border border-[color:var(--color-line)] rounded-full px-2 py-0.5">
                    {PRODUCT_LABEL[p.product]}
                  </span>
                </div>
                <span className="font-mono text-[12px] text-[color:var(--color-accent)]">
                  {p.commissionLabel}
                </span>
              </div>

              <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {p.fundsLabel}. {p.notes}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-[color:var(--color-fg-faint)]">
                <span>
                  Min: {p.minMonthsInBusiness}mo · $
                  {p.minMonthlyRevenueUsd.toLocaleString()}/mo revenue
                </span>
                <span>Ticket: {p.amountRange}</span>
                <span>{p.applyPath}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            What makes a referral fund
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>6+ months in business — 24+ for SBA tickets</li>
            <li>Real, bankable monthly revenue (statements back it up)</li>
            <li>A clear, fundable use of funds — not &ldquo;just cash&rdquo;</li>
            <li>Amount needed is proportional to revenue</li>
            <li>Owner is reachable and actually wants the money now</li>
          </ul>
        </div>
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            What stays off this desk
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>Any business or revenue figure you can&rsquo;t verify</li>
            <li>Shelf companies or &ldquo;aged&rdquo; entities bought to look established</li>
            <li>Fabricated tradelines or trade references to inflate a score</li>
            <li>Pulling or handling anyone&rsquo;s consumer credit yourself</li>
            <li>Promising an approval — you introduce, the lender decides</li>
          </ul>
        </div>
      </section>

      <div className="mt-10 flex items-center gap-3 flex-wrap">
        <Link
          href="/app/customers"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Mine your customer list for leads &rarr;
        </Link>
        <Link
          href="/app/lenders"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Lenders who fund <em>you</em> &rarr;
        </Link>
      </div>

      <p className="mt-8 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Curated as of 2026-05-22. Program names + URLs are public; revenue /
        tenure minimums and commission ranges are planning approximations and
        drift with each program&rsquo;s current terms. Confirm the live rate on
        each partner page before quoting yourself a number.
      </p>
    </main>
  );
}
