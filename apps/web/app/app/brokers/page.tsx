import Link from "next/link";
import { BROKERS, BROKER_TYPE_LABEL } from "@/lib/brokers";

export const dynamic = "force-dynamic";

export default function BrokersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Brokers</h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          The 9 main companies that connect banks (selling debt) with buyers (you, eventually).
          Think of them as the eBay of debt portfolios — you don&rsquo;t buy directly from
          banks, you go through these middlemen.
        </p>
      </header>

      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 mb-4">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What&rsquo;s a broker?
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          When a bank decides to sell debt, they don&rsquo;t post it on Twitter. They hire a
          broker — a middleman company that has a list of pre-vetted licensed buyers and runs
          the auction. The bank pays the broker a fee; the broker sends you (a buyer) a sample
          of the tape; you submit a bid; the highest bid wins.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          Most deals don&rsquo;t happen via formal auction. They happen via <em>relationship</em>
          {" "}— the broker emails their best buyers first. Building those relationships is the
          main reason people go to industry conferences (RMAI, Receivables Roundup).
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

      <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5 mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          Don&rsquo;t cold-contact yet
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          You can <em>study</em> brokers and their cadences now. You should not <em>contact</em>{" "}
          them as a prospective buyer until you hold a state license — they&rsquo;ll ask for it
          on the first call, and a cold inquiry without one burns the relationship before it
          starts. Read this page; visit at conferences; transact once licensed.
        </p>
      </div>

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
