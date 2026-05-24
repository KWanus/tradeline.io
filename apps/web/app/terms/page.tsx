import Link from "next/link";
import { PublicFooter } from "@/app/_components/public-footer";

export const dynamic = "force-dynamic";

const LAST_UPDATED = "2026-05-17";

export const metadata = {
  title: "Terms · Tradeline",
  description:
    "Terms of use for the Tradeline workbase and weekly Charge-Off Report. Plain English.",
};

export default function TermsPage() {
  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#0a0c14] font-semibold text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-semibold text-[18px]">Tradeline</span>
        </Link>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Terms of use
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl tracking-tight leading-[1.05]">
          The deal.
        </h1>
        <p className="mt-3 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          Last updated {LAST_UPDATED}.
        </p>

        <Section title="What Tradeline is">
          <p>
            Tradeline is a research and operations workbase for licensed
            non-performing-loan (NPL) buyers and the supply-side ecosystem
            (brokers, lenders, attorneys, CPAs). It includes the public weekly
            Charge-Off Report, the in-app workbase at <code>/app</code>, and the
            optional MCP server for AI-assistant integration.
          </p>
        </Section>

        <Section title="Not legal, financial, or investment advice">
          <p>
            Everything Tradeline publishes — the weekly report, in-app
            playbooks, state licensing guides, fund-formation timelines, bid
            calculators, AI tutor output — is{" "}
            <strong>educational content built from public-source data</strong>.
            None of it is legal, financial, investment, or tax advice.
          </p>
          <p>
            Buying or collecting consumer debt is regulated. Before you act on
            anything you read here, get an opinion from a consumer-finance
            attorney licensed in your state, a CPA who knows receivables, and —
            if you&rsquo;re raising outside capital — fund counsel. Tradeline
            tools are starting points for your own research, not substitutes for
            qualified professionals.
          </p>
        </Section>

        <Section title="Accuracy">
          <p>
            Public-source data can be wrong or stale. SEC filings are sometimes
            amended. Bank names change. State licensing regimes evolve. We do
            our best to keep things current but make no warranty that any
            specific number, name, threshold, or recommendation is accurate at
            the moment you read it.
          </p>
          <p>
            <strong>Verify everything that matters</strong> before you act:
            check the regulator&rsquo;s site for current license fees, read the
            actual filing in EDGAR before bidding, confirm a broker&rsquo;s
            licensure independently.
          </p>
        </Section>

        <Section title="Your responsibilities">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              You will not buy, sell, or attempt to collect consumer debt in any
              state where you are not properly licensed.
            </li>
            <li>
              You will not use Tradeline output to circumvent FCRA, FDCPA, Reg
              F, GLBA, state collection-agency law, or any state
              consumer-protection statute.
            </li>
            <li>
              You will not use the AI tutor (Tradeline AI) to generate
              communication that would violate the above when sent to a
              consumer.
            </li>
            <li>
              You will keep your buyer-profile information and any third-party
              data you process in the tape copilot lawful and in compliance with
              applicable privacy laws.
            </li>
          </ul>
        </Section>

        <Section title="Use of the workbase">
          <p>
            The workbase at <code>/app</code> is provided as-is. Today most
            state (your profile, pipeline, outreach log, watchlist) lives in
            your browser&rsquo;s localStorage and is yours to keep, copy, or
            delete. If you clear your browser data, it&rsquo;s gone. Tradeline
            does not back this up.
          </p>
          <p>
            Paid plans, when offered, will include written subscription terms
            superseding the use-of-workbase section here. Until then, you may
            use the workbase for your own debt-buying or ecosystem operations
            free of charge.
          </p>
        </Section>

        <Section title="Intellectual property">
          <p>
            Tradeline owns the workbase code, design, the radar scoring model,
            and the editorial weekly report. You own everything you create
            inside the workbase (your pipeline, notes, deals).
          </p>
          <p>
            You may quote, paraphrase, or share the weekly Charge-Off Report
            freely as long as you don&rsquo;t modify it or remove the Tradeline
            attribution. You may not republish it on a competing data product
            without written permission.
          </p>
        </Section>

        <Section title="No warranty / liability cap">
          <p>
            Tradeline is provided &ldquo;as is&rdquo; with no warranties, express
            or implied. We do not warrant fitness for any particular purpose,
            uninterrupted availability, or that any specific output will lead
            to a successful bid, collection, or business outcome.
          </p>
          <p>
            To the maximum extent permitted by law, Tradeline&rsquo;s liability
            for any loss arising from your use of the workbase, the weekly
            report, or any other Tradeline output is capped at the amount you
            paid Tradeline in the prior 12 months (which is currently zero for
            the free tiers).
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we materially change these terms, we update the last-updated
            date at the top and announce the change in the next Monday issue of
            the weekly report. Continued use of the workbase after a change
            constitutes acceptance.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the State of Maryland, USA,
            without regard to conflict-of-laws principles.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Email{" "}
            <a
              className="text-[color:var(--color-accent)] hover:underline"
              href="mailto:hello@tradeline.io"
            >
              hello@tradeline.io
            </a>
            .
          </p>
        </Section>
      </article>

      <PublicFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-semibold text-2xl tracking-tight text-[color:var(--color-fg)] mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}
