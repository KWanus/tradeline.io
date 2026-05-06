import Link from "next/link";
import {
  CATEGORY_DESCRIPTION,
  CATEGORY_LABEL,
  ORDER,
  providersByCategory,
  type ProviderCategory,
} from "@/lib/setup-providers";

export const dynamic = "force-dynamic";

export default function ProvidersPage() {
  const grouped = providersByCategory();

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-10">
        <Link
          href="/app/setup"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
        >
          &larr; Back to Setup
        </Link>
        <h1 className="mt-3 text-3xl md:text-4xl font-medium tracking-tight">
          Service providers
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          The companies you hire to handle each piece of your setup. Real names,
          real costs, links straight to their sites. Beginner-friendly tags
          marked with{" "}
          <span className="text-[color:var(--color-accent)]">●</span>.
        </p>
      </header>

      <nav className="mb-10 flex items-center gap-1 flex-wrap text-[11px] font-mono tracking-[0.18em] uppercase">
        {ORDER.map((c) => (
          <a
            key={c}
            href={`#${c}`}
            className="px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)] transition"
          >
            {CATEGORY_LABEL[c]}
          </a>
        ))}
      </nav>

      <div className="space-y-12">
        {ORDER.map((c) => (
          <section key={c} id={c}>
            <h2 className="text-2xl font-medium tracking-tight">
              {CATEGORY_LABEL[c]}
            </h2>
            <p className="mt-2 mb-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
              {CATEGORY_DESCRIPTION[c]}
            </p>
            <div className="space-y-3">
              {grouped[c].map((p) => (
                <article
                  key={p.name}
                  className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 hover:border-[color:var(--color-line-strong)] transition"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-lg font-medium text-[color:var(--color-fg)]">
                        {p.beginnerFriendly && (
                          <span
                            className="text-[color:var(--color-accent)] mr-2"
                            title="Beginner-friendly"
                          >
                            ●
                          </span>
                        )}
                        {p.name}
                      </h3>
                      <div className="mt-1 font-mono text-[12px] text-[color:var(--color-fg-dim)] tracking-[0.05em]">
                        {p.costRange}
                      </div>
                    </div>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                      >
                        Visit &rarr;
                      </a>
                    )}
                  </div>
                  <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {p.notes}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Curated as of 2026-05-06. Pricing is approximate; verify on each
        provider&rsquo;s site. Mention of a provider is not an endorsement —
        get your own counsel before signing anything.
      </p>
    </main>
  );
}
