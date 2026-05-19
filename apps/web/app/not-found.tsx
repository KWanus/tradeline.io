import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { PublicFooter } from "@/app/_components/public-footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Not found · Tradeline",
  description:
    "That page doesn't exist on Tradeline. Try the weekly report, the bank coverage list, or the changelog.",
};

export default async function NotFoundPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const banks = snap.originators.length || 57;

  const suggestions: Array<{
    href: string;
    title: string;
    description: string;
  }> = [
    {
      href: "/report",
      title: "The weekly Charge-Off Report",
      description:
        "Free. Subscribe and the current edition lands within seconds.",
    },
    {
      href: "/coverage",
      title: `Every bank we track (${banks})`,
      description:
        "Searchable + filterable. Probably has what you were looking for.",
    },
    {
      href: "/news",
      title: "Recent headlines",
      description:
        "Public news mentions matched to every tracked bank's CIK.",
    },
    {
      href: "/signals",
      title: "Recent SEC signals",
      description:
        "Scored 10-K / 10-Q / 8-K filings with YoY charge-off deltas.",
    },
    {
      href: "/changelog",
      title: "What's shipped",
      description:
        "Every release on Tradeline, newest first. Filter by tag.",
    },
    {
      href: "/about",
      title: "About + provenance",
      description: "How the radar works · what data we touch (and don't).",
    },
  ];

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px]">Tradeline</span>
        </Link>
        <Link
          href="/"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Home &nearr;
        </Link>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          404 · Not found
        </div>
        <h1 className="mt-3 font-serif text-5xl md:text-7xl tracking-tight leading-[0.95]">
          That page{" "}
          <span className="italic text-gradient-accent">isn&rsquo;t here.</span>
        </h1>
        <p className="mt-6 text-[17px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          Either the URL has a typo, the page moved, or it was a per-bank page
          for a ticker we don&rsquo;t (yet) track. Here&rsquo;s where to go next:
        </p>

        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
          {suggestions.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-bg-2)] transition"
            >
              <div className="text-[15px] font-medium text-[color:var(--color-fg)]">
                {s.title}
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {s.description}
              </div>
              <div className="mt-2 font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-accent)]">
                tradeline.io{s.href} &rarr;
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-10 rounded-xl border border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)] p-6 text-center">
          <p className="text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            Looking for a specific bank that isn&rsquo;t tracked yet? The radar
            adds new originators automatically when their SEC filings hit our
            NPL keyword filter. If you think a bank should be on the list,
            reply to any weekly issue or email{" "}
            <a
              href="mailto:hello@tradeline.io"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              hello@tradeline.io
            </a>{" "}
            — we&rsquo;ll look at it.
          </p>
        </section>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          If you got here from a Tradeline link that should have worked, that&rsquo;s
          on us — please{" "}
          <a
            href="https://github.com/KWanus/tradeline.io/issues/new"
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            open an issue
          </a>
          .
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}
