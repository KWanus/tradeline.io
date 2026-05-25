import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { BidEnvelopeSection } from "./_bid-envelope";
import { CapitalAllocationCalculator } from "./_calculator";
import { CapitalDeploymentTracker } from "./_deployment-tracker";
import { ReturnForecastSection } from "./_return-forecast";

export const dynamic = "force-dynamic";

export default function CapitalPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>$</span>}
        title="Capital"
        badge={{ label: "Plan", tone: "primary" }}
        tagline="Where the money goes — buy more, borrow, save, or branch out. Move the sliders to see the split that fits your stage."
        meta={
          <Link
            href="/app/learn#capital"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Allocation guide →
          </Link>
        }
      />

      <BidEnvelopeSection />
      <CapitalDeploymentTracker />
      <ReturnForecastSection />
      <CapitalAllocationCalculator />
    </main>
  );
}
