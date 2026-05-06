import { CapitalAllocationCalculator } from "./_calculator";

export const dynamic = "force-dynamic";

export default function CapitalPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Capital allocation
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          What to do with the money once you have it.
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Once you own paper and cash flow starts arriving, the next decision is
          where it goes. Reinvest? Hypothecate? Diversify? T-bills? This is the
          capital-allocation playbook seasoned NPL operators run, and a calculator
          to see what fits your situation.
        </p>
      </header>

      <CapitalAllocationCalculator />
    </main>
  );
}
