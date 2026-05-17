import Link from "next/link";
import { STATES, STATE_OVERVIEW } from "@/lib/setup-states";
import { StateRow } from "./_state-row";

export const dynamic = "force-dynamic";

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
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Each state below has a one-click action panel — copy a pre-filled
          application data sheet, email a bond carrier, or email your attorney.
          Set a status per state to track which filings are in-flight.
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
        <a
          href={`#${STATE_OVERVIEW.recommended_starting_state}`}
          className="mt-4 inline-block font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#1a0c00] hover:opacity-90 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          Jump to {STATE_OVERVIEW.recommended_starting_state} playbook ↓
        </a>
      </section>

      <div className="space-y-6">
        {STATES.map((s) => (
          <StateRow key={s.state} state={s} />
        ))}
      </div>

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Information is general guidance as of 2026-05-06. State licensing regimes change. Confirm with the state regulator directly and your consumer-finance attorney before filing anything.
      </p>
    </main>
  );
}
