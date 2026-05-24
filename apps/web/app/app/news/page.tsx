import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { EMPTY_SNAPSHOT, type NewsSignal, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { relativeAge } from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const params = await searchParams;
  const ticker = (params.ticker || "").toUpperCase();

  const matched = snap.matched_news;
  const filtered = ticker
    ? matched.filter((n) => n.matched_tickers?.includes(ticker))
    : matched;

  const tickerCounts = new Map<string, number>();
  for (const n of matched) {
    for (const t of n.matched_tickers || []) {
      tickerCounts.set(t, (tickerCounts.get(t) || 0) + 1);
    }
  }
  const popularTickers = [...tickerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <PageHeader
        icon={<span aria-hidden>▤</span>}
        title="News"
        badge={{ label: "Live", tone: "success" }}
        tagline="Bank headlines mentioning your watchlist. Updated hourly."
        meta={
          <Link
            href="/app/learn#news"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            News sources →
          </Link>
        }
      />

      <nav className="mb-6 flex items-center gap-1.5 flex-wrap text-[11px] font-mono tracking-[0.18em] uppercase">
        <Link
          href="/app/news"
          className={`px-3 py-1.5 rounded-md border transition ${
            !ticker
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
              : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
          }`}
        >
          All <span className="ml-1 text-[color:var(--color-fg-faint)]">{matched.length}</span>
        </Link>
        {popularTickers.map(([t, n]) => (
          <Link
            key={t}
            href={`/app/news?ticker=${t}`}
            className={`px-3 py-1.5 rounded-md border transition ${
              ticker === t
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            {t} <span className="ml-1 text-[color:var(--color-fg-faint)]">{n}</span>
          </Link>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
          No matched headlines{ticker ? ` for ${ticker}` : ""}.
        </div>
      ) : (
        <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
          {filtered.map((n: NewsSignal) => {
            const tickers = n.matched_tickers || [];
            const primary = tickers[0];
            return (
              <div
                key={n.source_id}
                className="px-5 py-3.5 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] flex-wrap">
                  {tickers.map((t) => (
                    <Link
                      key={t}
                      href={`/app/news?ticker=${t}`}
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
                  className="block mt-1 text-[14px] text-[color:var(--color-fg)] hover:text-[color:var(--color-accent)] transition"
                >
                  {n.title} &rarr;
                </a>
                {primary && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/app/banks/${primary}`}
                      className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded text-[#0a0c14] hover:opacity-90 transition"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      Act on this ⚡
                    </Link>
                    {tickers.slice(1).map((t) => (
                      <Link
                        key={t}
                        href={`/app/banks/${t}`}
                        className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                      >
                        {t} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
