import Link from "next/link";
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
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">News</h1>
        <p className="mt-2 text-[color:var(--color-fg-dim)]">
          Headlines from public RSS, joined to your seed banks. Click a ticker to filter.
        </p>
      </header>

      <nav className="mb-6 flex items-center gap-1 flex-wrap text-[11px] font-mono tracking-[0.18em] uppercase">
        <Link
          href="/app/news"
          className={`px-3 py-1.5 border transition ${
            !ticker
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
          }`}
        >
          All <span className="ml-1 text-[color:var(--color-fg-faint)]">{matched.length}</span>
        </Link>
        {popularTickers.map(([t, n]) => (
          <Link
            key={t}
            href={`/app/news?ticker=${t}`}
            className={`px-3 py-1.5 border transition ${
              ticker === t
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            {t} <span className="ml-1 text-[color:var(--color-fg-faint)]">{n}</span>
          </Link>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
          No matched headlines{ticker ? ` for ${ticker}` : ""}.
        </div>
      ) : (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
          {filtered.map((n: NewsSignal) => (
            <div
              key={n.source_id}
              className="px-5 py-3.5 hover:bg-[color:var(--color-bg-2)] transition"
            >
              <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                {(n.matched_tickers || []).map((t) => (
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
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Source: Google News RSS. Matching is substring-based against curated bank-name aliases — false
        positives are minimized but can happen. International results (e.g. CIMB Thailand) are surfaced
        in the unmatched firehose, not here.
      </p>
    </main>
  );
}
