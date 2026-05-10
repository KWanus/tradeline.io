import { PageIntro } from "../_components/page-intro";
import { BROKERS, BROKER_TYPE_LABEL } from "@/lib/brokers";

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
          <article
            key={b.shortName}
            className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 hover:border-[color:var(--color-line-strong)] transition"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-medium text-[color:var(--color-fg)]">{b.name}</h2>
                <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                  {BROKER_TYPE_LABEL[b.type]}
                </div>
              </div>
              <a
                href={b.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
              >
                Visit &rarr;
              </a>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Asset class">
                <div className="flex flex-wrap gap-1.5">
                  {b.assetClass.map((a) => (
                    <span
                      key={a}
                      className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </Field>
              <Field label="Posting cadence">{b.cadence}</Field>
              <Field label="Typical deal size">{b.typicalDealSize}</Field>
            </div>

            <div className="mt-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              {b.notes}
            </div>

            <div className="mt-4 font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
              How buyers reach them: <span className="text-[color:var(--color-fg-dim)] tracking-normal lowercase">{b.contactPath}</span>
            </div>
          </article>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className="mt-1.5 text-[13px] text-[color:var(--color-fg)]">{children}</div>
    </div>
  );
}
