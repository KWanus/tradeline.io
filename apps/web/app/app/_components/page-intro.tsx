import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  lead: ReactNode;
  doNow?: ReactNode;
  howThisWorks?: ReactNode;
};

export function PageIntro({ eyebrow, title, lead, doNow, howThisWorks }: Props) {
  return (
    <section className="mb-10">
      {eyebrow && (
        <div className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] font-mono">
          {eyebrow}
        </div>
      )}
      <h1 className="mt-3 font-serif text-4xl md:text-5xl tracking-tight leading-[1.02] text-[color:var(--color-fg)]">
        {title}
      </h1>
      <p className="mt-4 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-3xl">
        {lead}
      </p>

      {doNow && (
        <div className="mt-5 inline-flex items-start gap-3 px-4 py-3 rounded-lg bg-[color:var(--color-accent-soft)] border border-[color:var(--color-accent-dim)] max-w-3xl">
          <span className="shrink-0 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mt-0.5">
            Do now
          </span>
          <span className="text-[14px] text-[color:var(--color-fg)] leading-snug">{doNow}</span>
        </div>
      )}

      {howThisWorks && (
        <details className="group mt-6 max-w-3xl">
          <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-[13px] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase border border-[color:var(--color-line-strong)] rounded px-2 py-0.5 group-hover:border-[color:var(--color-accent)] group-hover:text-[color:var(--color-accent)] transition">
              How this works
            </span>
            <span className="text-[color:var(--color-fg-faint)] group-open:rotate-90 inline-block transition-transform">
              ›
            </span>
          </summary>
          <div className="mt-3 p-4 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed space-y-2">
            {howThisWorks}
          </div>
        </details>
      )}
    </section>
  );
}
