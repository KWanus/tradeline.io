import Link from "next/link";
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
          Once your debt portfolios are paying you, you have a question every
          successful debt buyer faces: where does the money go? Buy more debt? Borrow
          against what you have? Save for a downturn? Diversify into something else?
        </p>
      </header>

      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Why this page exists
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          New buyers usually have one strategy: &ldquo;buy more debt.&rdquo;
          That&rsquo;s reasonable for the first year. After that, it gets dangerous.
          Concentration risk grows, you skip building reserves, you under-allocate to
          things that compound (like leverage). This page walks through the 9
          options seasoned operators actually use, with pros, cons, and a calculator
          that suggests an allocation based on your stage.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
          The calculator is heuristic, not financial advice. It&rsquo;s here to make
          you <em>think</em> about the trade-offs, not tell you exactly what to do.
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

      <CapitalAllocationCalculator />
    </main>
  );
}
