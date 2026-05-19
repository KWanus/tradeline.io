import Link from "next/link";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { PublicFooter } from "@/app/_components/public-footer";
import { jsonLdScript, newsCollectionLd } from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 40;

export const metadata = {
  title: "News · headlines on every tracked bank · Tradeline",
  description:
    "Every news headline matched to one of the 57 US banks Tradeline tracks. Filtered from public news feeds, scored by recency. Click any headline to read the source.",
  openGraph: {
    title: "Tradeline · headlines on every tracked bank",
    description:
      "Public news mentions matched to the 57 banks on the Tradeline radar.",
    type: "website" as const,
  },
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function relativeAge(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 2) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)}+ yr ago`;
}

export default async function PublicNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const params = await searchParams;
  const activeTicker = (params.ticker || "").trim().toUpperCase();

  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const all = snap.matched_news || [];
  const matchedTickerCounts = new Map<string, number>();
  for (const n of all) {
    for (const t of n.matched_tickers || []) {
      matchedTickerCounts.set(t, (matchedTickerCounts.get(t) || 0) + 1);
    }
  }
  const topTickers = [...matchedTickerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14);

  const filtered = activeTicker
    ? all.filter((n) => (n.matched_tickers || []).includes(activeTicker))
    : all;
  const visible = filtered.slice(0, DEFAULT_LIMIT);
  const truncated = filtered.length > visible.length;

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          newsCollectionLd({
            totalHeadlines: filtered.length,
            tickerCount: matchedTickerCounts.size,
            activeTicker: activeTicker || null,
          })
        )}
      />
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-4xl px-6 pt-8 pb-4 flex items-center justify-between">
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
          href="/report"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Subscribe &rarr;
        </Link>
      </header>

      <article className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          News
          {activeTicker && (
            <>
              {" · "}
              <span className="text-[color:var(--color-accent)]">
                {activeTicker}
              </span>
            </>
          )}
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          Headlines on{" "}
          <span className="italic text-gradient-accent">tracked banks.</span>
        </h1>
        <p className="mt-5 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          {activeTicker ? (
            <>
              {filtered.length} matched headline
              {filtered.length === 1 ? "" : "s"} mentioning{" "}
              <span className="font-mono text-[color:var(--color-accent)]">
                {activeTicker}
              </span>
              .{" "}
              <Link
                href="/news"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                Show all banks
              </Link>
              .
            </>
          ) : (
            <>
              {all.length} headlines tracked across {topTickers.length} banks.
              Pulled from public news feeds every few hours, filtered to
              names on the Tradeline radar. Click any headline to read the
              source.
            </>
          )}
        </p>

        {/* Ticker chip filter */}
        {topTickers.length > 0 && (
          <nav className="mt-6 flex items-center gap-2 flex-wrap">
            <Link
              href="/news"
              className={`font-mono text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 rounded border transition ${
                !activeTicker
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
              }`}
            >
              All{" "}
              <span className="ml-1 text-[color:var(--color-fg-faint)]">
                {all.length}
              </span>
            </Link>
            {topTickers.map(([ticker, count]) => (
              <Link
                key={ticker}
                href={`/news?ticker=${ticker}`}
                className={`font-mono text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 rounded border transition ${
                  activeTicker === ticker
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                }`}
              >
                {ticker}{" "}
                <span className="ml-1 text-[color:var(--color-fg-faint)]">
                  {count}
                </span>
              </Link>
            ))}
          </nav>
        )}

        {visible.length === 0 ? (
          <section className="mt-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {activeTicker ? (
              <>
                No headlines matched{" "}
                <span className="font-mono text-[color:var(--color-accent)]">
                  {activeTicker}
                </span>{" "}
                yet. Subscribe to{" "}
                <Link
                  href="/report"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  /report
                </Link>{" "}
                to be told when that changes.
              </>
            ) : (
              <>
                Quiet week. No matched headlines in the current snapshot.
                Subscribe to{" "}
                <Link
                  href="/report"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  /report
                </Link>{" "}
                to get the next one when it lands.
              </>
            )}
          </section>
        ) : (
          <section className="mt-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)] overflow-hidden">
            {visible.map((n) => {
              const tickers = n.matched_tickers || [];
              const primary = tickers[0];
              return (
                <article
                  key={n.source_id}
                  className="px-5 py-4 hover:bg-[color:var(--color-bg-2)] transition"
                >
                  <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] flex-wrap">
                    {tickers.map((t) => (
                      <Link
                        key={t}
                        href={`/news?ticker=${t}`}
                        className="text-[color:var(--color-accent)] hover:underline"
                      >
                        {t}
                      </Link>
                    ))}
                    <span>{relativeAge(n.published_at)}</span>
                    {n.publisher && (
                      <span className="ml-auto truncate max-w-[40%] text-[color:var(--color-fg-dim)]">
                        {n.publisher}
                      </span>
                    )}
                  </div>
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block mt-1.5 text-[15px] text-[color:var(--color-fg)] hover:text-[color:var(--color-accent)] transition"
                  >
                    {n.title} &rarr;
                  </a>
                  {primary && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/banks/${primary}`}
                        className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                      >
                        See {primary} on the radar &rarr;
                      </Link>
                      <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
                        published {fmtDate(n.published_at)}
                      </span>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {truncated && (
          <p className="mt-4 text-[12px] font-mono text-[color:var(--color-fg-faint)] text-center">
            Showing {visible.length} of {filtered.length}. Subscribe to{" "}
            <Link
              href="/report"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              /report
            </Link>{" "}
            for the weekly synthesis.
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-3 flex-wrap text-[11px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          <span>Take the data:</span>
          <a
            href={`/news.csv${activeTicker ? `?ticker=${activeTicker}` : ""}`}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            CSV &nearr;
          </a>
          <a
            href={`/api/news${activeTicker ? `?ticker=${activeTicker}` : ""}`}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            JSON &nearr;
          </a>
          <Link
            href="/feeds"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            All formats
          </Link>
        </div>

        <section className="mt-12 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-8 text-center">
          <h2 className="font-serif text-2xl tracking-tight">
            Get this digested every Monday.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto leading-relaxed">
            Tradeline scans these headlines + SEC filings + XBRL charge-off
            concepts + court dockets, then ranks the 57 banks every Monday.
            Free. No paywall. No consumer data.
          </p>
          <div className="mt-5">
            <Link
              href="/report"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#1a0c00] hover:opacity-90 transition inline-block"
              style={{ background: "var(--gradient-primary)" }}
            >
              Subscribe &rarr;
            </Link>
          </div>
        </section>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          Snapshot generated {snap.generated_at?.slice(0, 16) || "—"} UTC.
          News pulled from public feeds; matched against tracked-bank CIKs and
          names. No consumer or debtor data anywhere.
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}
