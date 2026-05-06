import { BidCalculator } from "./calculator";

export const dynamic = "force-dynamic";

export default function BidCalculatorPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Bid calculator</h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Given an estimated recovery rate, work-out time, and your IRR target, compute the
          maximum bid that pencils. The math, not the relationship.
        </p>
      </header>

      <BidCalculator />

      <section className="mt-12 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          How to use this
        </div>
        <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>Estimate <em>gross recovery</em> as a percentage of face value over the work-out period. Industry numbers for unsecured consumer paper run 8–18% over 5–7 years; secured paper much higher.</li>
          <li>Set <em>servicing fees</em> — third-party servicers typically take 25–45% of collected dollars; affects your net.</li>
          <li>Set <em>target IRR</em> — what return on capital makes you accept this risk. Solo buyers often target 25–40% on first deals.</li>
          <li>The result is your <em>max bid</em> — go above and the math doesn&rsquo;t pencil. Most disciplined buyers bid below the max to leave margin for surprises.</li>
        </ul>
      </section>

      <section className="mt-6 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Caveats
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          This is a deterministic NPV. Real underwriting models for tapes also account for
          recovery <em>timing</em> distribution (cash comes in unevenly across 5+ years), state
          mix (collection rates vary), legal cost reserves, statute-of-limitations exposure,
          and your servicer&rsquo;s historical recovery against similar paper. The Phase-2
          tape evaluation copilot will fold all of those in. This page is the back-of-envelope
          sanity check.
        </p>
      </section>
    </main>
  );
}
