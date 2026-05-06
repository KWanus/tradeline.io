import Link from "next/link";
import { ComplianceBoard } from "./_compliance-board";

export const dynamic = "force-dynamic";

export default function CompliancePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
          Compliance
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          The boring-but-mandatory stuff: state licenses, bond renewals, statute-of-
          limitations rules. Track it here so it doesn&rsquo;t blindside you.
        </p>
      </header>

      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Why do I need licenses?
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          Most US states require a debt buyer to be licensed before legally buying or
          collecting consumer debt. The licenses cost $1k–$10k to file plus a $5k–
          $50k surety bond depending on the state. They have to be renewed every 1–2
          years, and the renewal calendar is brutal — miss a deadline and you&rsquo;re
          collecting illegally until you reinstate.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          This page tracks each state license you hold: when it expires, the bond
          carrier, the bond amount, and the annual fee. It alerts you 90 days before
          any expiration so renewals don&rsquo;t catch you off guard. It also
          includes a state-by-state Statute of Limitations chart — how many years
          after default you can still legally collect, which varies by state from 3
          years to 10+.
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

      <ComplianceBoard />
    </main>
  );
}
