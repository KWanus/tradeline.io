import Link from "next/link";
import { SetupBoard } from "./_setup-board";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Setup hub
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          From zero to operational, step by step.
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          The 19 things you need to set up to actually do this business —
          tracked, with links to the right service providers, and a checklist
          you can come back to.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <Link
          href="/app/setup/license"
          className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 hover:border-[color:var(--color-accent)] transition"
        >
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            State playbooks
          </div>
          <div className="mt-2 text-[15px] text-[color:var(--color-fg)] font-medium">
            Where to start?
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
            VA / MD / NC / GA license requirements.
          </div>
        </Link>
        <Link
          href="/app/setup/providers"
          className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 hover:border-[color:var(--color-accent)] transition"
        >
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Service providers
          </div>
          <div className="mt-2 text-[15px] text-[color:var(--color-fg)] font-medium">
            Who to hire?
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
            Real companies: RAs, banks, surety, attorneys.
          </div>
        </Link>
        <Link
          href="/app/setup/fund"
          className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 hover:border-[color:var(--color-accent)] transition"
        >
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Fund formation
          </div>
          <div className="mt-2 text-[15px] text-[color:var(--color-fg)] font-medium">
            The endgame
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
            5-year path · LLC vs C-Corp · LP types.
          </div>
        </Link>
        <Link
          href="/app/tutor"
          className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 hover:border-[color:var(--color-accent)] transition"
        >
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            AI tutor
          </div>
          <div className="mt-2 text-[15px] text-[color:var(--color-fg)] font-medium">
            Ask anything
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
            Claude tutor knows everything.
          </div>
        </Link>
      </div>

      <SetupBoard />

      <section className="mt-12 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          Honest expectation-setting
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          From &ldquo;I&rsquo;ve never done this&rdquo; to &ldquo;I&rsquo;ve closed my first deal&rdquo; is{" "}
          <strong className="text-[color:var(--color-fg)]">3-6 months and $5k-$50k</strong>,
          depending on your state choice and capital. Most of that time is
          waiting on regulators, not doing work. The setup itself is maybe 20
          hours of forms and phone calls.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Anyone telling you it can happen in 30 days for $500 is either lying
          or in a state with no license requirement (Georgia is closest — see
          the State Playbooks).
        </p>
      </section>
    </main>
  );
}
