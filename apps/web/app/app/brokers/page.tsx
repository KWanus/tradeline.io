import { PageIntro } from "../_components/page-intro";
import { BROKERS } from "@/lib/brokers";
import { BrokerRow } from "./_broker-row";

export const dynamic = "force-dynamic";

export default function BrokersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Ecosystem"
        title={<>The middlemen who sell debt.</>}
        lead={
          <>
            Banks don&rsquo;t sell debt directly to buyers — they hire brokers to
            run the auction. These are the 9 main US brokers. Think eBay for debt
            portfolios. You build relationships with them before you bid.
          </>
        }
        doNow="Study this list now. Don't email anyone yet — they'll ask for your state license on the first call, and you don't have one until you've finished Path B."
        howThisWorks={
          <>
            <p>
              When a bank decides to sell debt, they hire a broker who has a list
              of pre-vetted licensed buyers. The bank pays the broker; the broker
              sends you a sample of the tape; you bid; highest bid wins.
            </p>
            <p>
              Most deals don&rsquo;t go through formal auctions — they go through
              relationships. The broker emails their best buyers first. The bid
              never even posts publicly. That&rsquo;s why people go to industry
              conferences (RMAI, Receivables Roundup) — to be on those private
              lists.
            </p>
          </>
        }
      />

      <section className="space-y-3">
        {BROKERS.map((b) => (
          <BrokerRow key={b.shortName} broker={b} />
        ))}
      </section>

      <section className="mt-12 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What this becomes in Phase 2
        </div>
        <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>Live posting feed per broker — Tradeline ingests their listing pages and pings you when matching paper appears</li>
          <li>Your bid history per broker — close rate, average days to close, post-close behavior</li>
          <li>Broker reputation scoring (tape accuracy, post-close cooperation) once enough customers contribute data</li>
          <li>Tradeline-mediated bid platform (Phase 3) — submit bids without leaving the workbase</li>
        </ul>
      </section>

      <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Curated as of 2026-05-06. Names + URLs are public; cadence and notes are starting
        approximations and will drift. Verify before approaching.
      </p>
    </main>
  );
}

