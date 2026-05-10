import { Suspense } from "react";
import { TutorChat } from "./_chat";

export const dynamic = "force-dynamic";

export default function TutorPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <header className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Tradeline AI · Claude Sonnet 4.6
        </div>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl tracking-tight leading-[1.05] text-[color:var(--color-fg)]">
          Your operator assistant.{" "}
          <span className="italic text-[color:var(--color-accent)]">Knows everything.</span>
        </h1>
        <p className="mt-4 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-3xl">
          Knows every page on this site, every broker, every lender, every servicer,
          every regulation (FCRA, FDCPA, Reg F, GLBA), the deal math, your buyer
          profile, your pipeline, your watchlist, and your outreach log. Flip on{" "}
          <strong className="text-[color:var(--color-accent)]">Research mode</strong>{" "}
          and it can search the web for current industry data, new CFPB rules,
          competitor offerings, and more efficient ways to do your work.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
            Loading tutor…
          </div>
        }
      >
        <TutorChat />
      </Suspense>

      <section className="mt-12 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What it&rsquo;s good for
        </div>
        <ul className="mt-3 space-y-1 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          <li>Explaining a term you don&rsquo;t recognize (&ldquo;what&rsquo;s a putback?&rdquo;)</li>
          <li>Walking through deal math step by step</li>
          <li>Comparing two states&rsquo; license requirements</li>
          <li>Drafting an outreach email to a broker</li>
          <li>Sanity-checking a bid you&rsquo;re considering</li>
        </ul>
      </section>

      <section className="mt-3 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What it&rsquo;s NOT good for
        </div>
        <ul className="mt-3 space-y-1 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          <li>Giving state-specific legal advice — get an attorney</li>
          <li>Confirming whether a specific deal is &ldquo;a good buy&rdquo; — that&rsquo;s your judgment</li>
          <li>Replacing your CPA, your servicer, or your broker</li>
          <li>Anything outside the debt-buying industry</li>
        </ul>
      </section>

      <p className="mt-8 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Chat history is stored only on this device (localStorage). The
        Anthropic API does not retain prompts after the response. If the tutor
        gives wrong information, it&rsquo;s your responsibility to verify.
      </p>
    </main>
  );
}
