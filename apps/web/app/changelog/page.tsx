import Link from "next/link";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog-entries";
import { PublicFooter } from "@/app/_components/public-footer";
import { changelogLd, jsonLdScript } from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata = {
  title: "Changelog · Tradeline",
  description:
    "What's shipped on Tradeline — the radar, the workbase, the weekly Charge-Off Report. Newest first.",
  openGraph: {
    title: "Tradeline changelog",
    description: "What's shipped on Tradeline. Newest first.",
    type: "website" as const,
  },
};

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const params = await searchParams;
  const activeTag = (params.tag || "").trim().toLowerCase();

  // Build the tag index from the full changelog so chip counts stay stable
  // regardless of the active filter.
  const tagCounts = new Map<string, number>();
  for (const entry of CHANGELOG) {
    for (const t of entry.tags || []) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const tagList = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  const entries = activeTag
    ? CHANGELOG.filter((e) => (e.tags || []).includes(activeTag))
    : CHANGELOG;
  const filteredTotal = entries.reduce((n, e) => n + e.bullets.length, 0);

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          changelogLd({
            count: CHANGELOG.length,
            latest: CHANGELOG[0]?.date,
          })
        )}
      />
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#0a0c14] font-semibold text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-semibold text-[18px]">Tradeline</span>
        </Link>
        <Link
          href="/report"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Subscribe &rarr;
        </Link>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Changelog
          {activeTag && (
            <>
              {" · "}
              <span className="text-[color:var(--color-accent)]">#{activeTag}</span>
            </>
          )}
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          What&rsquo;s{" "}
          <span className="italic text-gradient-accent">shipped.</span>
        </h1>
        <div className="mt-4 flex items-center gap-3 flex-wrap text-[11px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          <span>Take the data:</span>
          <a
            href={`/changelog.csv${activeTag ? `?tag=${encodeURIComponent(activeTag)}` : ""}`}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            CSV &nearr;
          </a>
          <a
            href={`/api/changelog${activeTag ? `?tag=${encodeURIComponent(activeTag)}` : ""}`}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            JSON &nearr;
          </a>
          <a
            href="/changelog.xml"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            RSS &nearr;
          </a>
        </div>
        <p className="mt-5 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          {activeTag ? (
            <>
              {entries.length} release{entries.length === 1 ? "" : "s"} tagged{" "}
              <span className="font-mono text-[color:var(--color-accent)]">
                #{activeTag}
              </span>{" "}
              · {filteredTotal} shipped items.{" "}
              <Link
                href="/changelog"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                Show all
              </Link>
              .
            </>
          ) : (
            <>
              {CHANGELOG.length} releases, {filteredTotal} shipped items.
              Newest first. The full git log lives at{" "}
              <a
                href="https://github.com/KWanus/tradeline.io/commits/main"
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                github.com/KWanus/tradeline.io
              </a>
              . Subscribe via{" "}
              <a
                href="/changelog.xml"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                RSS &nearr;
              </a>
              .
            </>
          )}
        </p>

        {/* Tag chip filter */}
        {tagList.length > 0 && (
          <nav className="mt-6 flex items-center gap-2 flex-wrap">
            <Link
              href="/changelog"
              className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border transition ${
                !activeTag
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
              }`}
            >
              All <span className="ml-1 text-[color:var(--color-fg-faint)]">{CHANGELOG.length}</span>
            </Link>
            {tagList.map(([tag, count]) => (
              <Link
                key={tag}
                href={`/changelog?tag=${encodeURIComponent(tag)}`}
                className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border transition ${
                  activeTag === tag
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                }`}
              >
                #{tag}{" "}
                <span className="ml-1 text-[color:var(--color-fg-faint)]">
                  {count}
                </span>
              </Link>
            ))}
          </nav>
        )}

        {entries.length === 0 ? (
          <section className="mt-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            No releases tagged{" "}
            <span className="font-mono text-[color:var(--color-accent)]">
              #{activeTag}
            </span>{" "}
            yet.{" "}
            <Link
              href="/changelog"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              See everything
            </Link>
            .
          </section>
        ) : (
          <section className="mt-10 space-y-10">
            {entries.map((entry, i) => {
              // Use the original index from the full changelog so anchor IDs
              // stay stable even when the filter narrows the list. RSS feed
              // links target #date-N where N is the absolute index.
              const absoluteIdx = CHANGELOG.indexOf(entry);
              return (
                <Entry
                  key={`${entry.date}-${absoluteIdx}`}
                  entry={entry}
                  index={absoluteIdx}
                  activeTag={activeTag}
                />
              );
            })}
          </section>
        )}

        <section className="mt-14 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-8 text-center">
          <h2 className="font-serif text-2xl tracking-tight">
            Subscribe to the weekly.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto">
            New product changes ship continuously. New issues of the
            Charge-Off Report ship every Monday. The first one&rsquo;s on its
            way the moment you subscribe.
          </p>
          <div className="mt-5">
            <Link
              href="/report"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#0a0c14] hover:opacity-90 transition inline-block"
              style={{ background: "var(--gradient-primary)" }}
            >
              Subscribe &rarr;
            </Link>
          </div>
        </section>
      </article>

      <PublicFooter />
    </main>
  );
}

function Entry({
  entry,
  index,
  activeTag,
}: {
  entry: ChangelogEntry;
  index: number;
  activeTag: string;
}) {
  const anchor = `${entry.date}-${index}`;
  return (
    <article
      id={anchor}
      className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-7 scroll-mt-20"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-2xl md:text-3xl tracking-tight italic text-[color:var(--color-fg)]">
          <a
            href={`#${anchor}`}
            className="hover:text-[color:var(--color-accent)] transition"
            title="Link to this release"
          >
            {entry.title}
          </a>
        </h2>
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          {entry.date}
        </span>
      </div>
      {entry.tags && entry.tags.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {entry.tags.map((t) => (
            <Link
              key={t}
              href={`/changelog?tag=${encodeURIComponent(t)}`}
              className={`font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 rounded border transition ${
                activeTag === t
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] bg-[color:var(--color-bg-soft)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent-dim)]"
              }`}
            >
              #{t}
            </Link>
          ))}
        </div>
      )}
      {entry.summary && (
        <p className="mt-4 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {entry.summary}
        </p>
      )}
      <ul className="mt-4 space-y-1.5 list-disc pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {entry.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </article>
  );
}
