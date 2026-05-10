import { PageIntro } from "../../_components/page-intro";
import { BidCalculator } from "./calculator";

export const dynamic = "force-dynamic";

export default function BidCalculatorPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <PageIntro
        eyebrow="Tool"
        title={<>What should you bid?</>}
        lead={
          <>
            Tell it three things — how much you think you&rsquo;ll recover, how long
            it&rsquo;ll take, and the return you want — and it tells you the highest
            price that still pencils. Bid above that and the math breaks.
          </>
        }
        doNow="Slide the three inputs below. The max-bid number updates as you move them."
        howThisWorks={
          <>
            <p>
              <strong>Recovery rate</strong> — what percent of the face value you
              think you&rsquo;ll actually collect. Plain consumer paper usually runs
              8–18% over 5–7 years. Backed paper (auto, mortgage) is much higher.
            </p>
            <p>
              <strong>Servicing fee</strong> — what your collector takes off the
              top. Most third-party servicers take 25–45% of dollars collected.
            </p>
            <p>
              <strong>Target return</strong> — what return on your money makes the
              risk worth it. Solo buyers usually want 25–40% on early deals.
            </p>
            <p>
              The number it spits out is your <em>ceiling</em>. Real buyers bid
              under their ceiling to leave room for surprises.
            </p>
          </>
        }
      />

      <BidCalculator />

      <section className="mt-12 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-fg-faint)] uppercase">
          What this calculator does NOT account for
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          This is a back-of-envelope check, not a real underwriting model. It
          assumes cash comes in evenly over the work-out period. In real life:
          recovery is uneven, some states collect better than others, legal costs
          eat into returns, and statute-of-limitations exposure varies by state.
          The full tape copilot (coming) will fold those in.
        </p>
      </section>
    </main>
  );
}
