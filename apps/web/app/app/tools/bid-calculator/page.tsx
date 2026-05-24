import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "../../_components/page-header";
import { BidCalculator } from "./calculator";

export const dynamic = "force-dynamic";

export default function BidCalculatorPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <PageHeader
        icon={<span aria-hidden>≡</span>}
        title="Bid calculator"
        badge={{ label: "Tool", tone: "primary" }}
        tagline="What to offer on a tape — face value × recovery × time × cost of capital."
        meta={
          <Link
            href="/app/learn#bid-calculator"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Math behind it →
          </Link>
        }
      />

      <Suspense
        fallback={
          <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
            Loading calculator…
          </div>
        }
      >
        <BidCalculator />
      </Suspense>

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
