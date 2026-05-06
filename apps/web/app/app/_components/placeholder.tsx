import Link from "next/link";

export type PlaceholderProps = {
  scope: string;          // "PHASE 2" | "YEAR 2" | etc — small uppercase
  title: string;
  lede: string;
  becomes: string[];      // bullet list of what this page becomes
  whenItShips: React.ReactNode;
  whyItMatters: React.ReactNode;
  compliance?: React.ReactNode;     // optional callout for regulated features
};

export function PlaceholderPage(props: PlaceholderProps) {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <header className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
          {props.scope}
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          {props.title}
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          {props.lede}
        </p>
      </header>

      <section className="space-y-6">
        <Card title="What this page becomes">
          <ul className="space-y-1.5 list-disc pl-5">
            {props.becomes.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Card>

        <Card title="When it ships">{props.whenItShips}</Card>
        <Card title="Why it matters for being the standard">{props.whyItMatters}</Card>

        {props.compliance && <Card title="Compliance posture">{props.compliance}</Card>}
      </section>

      <div className="mt-10">
        <Link
          href="/app/roadmap"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          See the full vision &amp; roadmap &rarr;
        </Link>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {title}
      </div>
      <div className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}
