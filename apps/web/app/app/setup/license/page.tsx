import Link from "next/link";
import { STATES, STATE_OVERVIEW, type StatePlaybook } from "@/lib/setup-states";

export const dynamic = "force-dynamic";

const DIFFICULTY_COPY: Record<StatePlaybook["difficulty"], { label: string; tone: string }> = {
  easy: {
    label: "Easy",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  },
  moderate: {
    label: "Moderate",
    tone: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  },
  strict: {
    label: "Strict",
    tone: "text-[color:var(--color-danger)] border-[color:var(--color-danger)]",
  },
};

export default function LicenseStatePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <header className="mb-10">
        <Link
          href="/app/setup"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
        >
          &larr; Back to Setup
        </Link>
        <h1 className="mt-3 text-3xl md:text-4xl font-medium tracking-tight">
          State playbooks
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Where you set up matters. Some states require both a debt-buyer
          license AND a collection-agency license. Some require neither (if you
          use a third-party servicer). Costs range from $100 to $2,000+ in
          fees, plus surety bonds of $0 to $50,000.
        </p>
      </header>

      <section className="mb-10 border border-[color:var(--color-accent-dim)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-accent)] uppercase">
          Recommended starting state
        </div>
        <h2 className="mt-2 text-2xl font-medium tracking-tight">
          {STATE_OVERVIEW.recommended_starting_state} ·{" "}
          {STATES.find((s) => s.state === STATE_OVERVIEW.recommended_starting_state)?.name}
        </h2>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {STATE_OVERVIEW.recommendation_reason}
        </p>
      </section>

      <div className="space-y-6">
        {STATES.map((s) => (
          <article
            key={s.state}
            id={s.state}
            className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-3xl text-[color:var(--color-accent)]">
                    {s.state}
                  </span>
                  <span className="text-xl text-[color:var(--color-fg)]">{s.name}</span>
                </div>
              </div>
              <span
                className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border ${DIFFICULTY_COPY[s.difficulty].tone}`}
              >
                {DIFFICULTY_COPY[s.difficulty].label}
              </span>
            </div>

            <p className="mt-4 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              {s.beginnerNotes}
            </p>

            {/* Stats grid */}
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <Stat
                label="Buyer license"
                value={s.buyerLicenseRequired ? "Required" : "Not required"}
                tone={s.buyerLicenseRequired ? "warn" : "ok"}
              />
              <Stat
                label="Collection license"
                value={s.collectionLicenseRequired ? "Required (if self-collect)" : "Not required"}
                tone={s.collectionLicenseRequired ? "warn" : "ok"}
              />
              <Stat
                label="Filing fee"
                value={s.filingFeeUsd === 0 ? "—" : `$${s.filingFeeUsd}`}
              />
              <Stat
                label="Bond"
                value={s.bondAmountUsd === 0 ? "—" : `$${s.bondAmountUsd.toLocaleString()}`}
              />
            </div>
            <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <Stat label="Annual renewal" value={s.annualRenewalFeeUsd === 0 ? "—" : `$${s.annualRenewalFeeUsd}`} />
              <Stat label="Timeline" value={s.typicalTimelineDays} />
              <Stat label="Regulator" value={s.regulatorName.split(",")[0]} />
              <Stat
                label="Apply at"
                value={
                  <a
                    href={s.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--color-accent)] hover:underline"
                  >
                    State portal &rarr;
                  </a>
                }
              />
            </div>

            {/* Steps */}
            <div className="mt-6">
              <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
                Step-by-step in {s.state}
              </div>
              <ol className="mt-3 space-y-1.5 list-decimal pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {s.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Red flags */}
            {s.redFlags.length > 0 && (
              <div className="mt-5 border border-[color:var(--color-line)] bg-[color:var(--color-bg-2)] p-4">
                <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
                  Heads-up before you commit
                </div>
                <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {s.redFlags.map((flag, i) => (
                    <li key={i}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <a
                href={s.regulatorUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
              >
                Regulator site &rarr;
              </a>
              <a
                href={s.applicationUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
              >
                Application &rarr;
              </a>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Information is general guidance as of 2026-05-06. State licensing regimes change. Confirm with the state regulator directly and your consumer-finance attorney before filing anything.
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "default";
}) {
  const color =
    tone === "warn"
      ? "text-[color:var(--color-warn)]"
      : tone === "ok"
      ? "text-[color:var(--color-accent)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-3">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-1 text-[13px] font-mono ${color}`}>{value}</div>
    </div>
  );
}
