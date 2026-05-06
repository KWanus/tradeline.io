import Link from "next/link";
import { EMPTY_SNAPSHOT, type Originator, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import {
  plainSignal,
  relativeAge,
  STATUS_COPY,
  statusFor,
  topSignalFor,
} from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Filter = "all" | "strong" | "watching" | "quiet";

export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const params = await searchParams;
  const filter: Filter =
    params.filter === "strong" || params.filter === "watching" || params.filter === "quiet"
      ? params.filter
      : "all";
  const q = (params.q || "").trim().toLowerCase();

  let banks: Originator[] = snap.originators;
  if (filter !== "all") {
    banks = banks.filter((o) => statusFor(o) === filter);
  }
  if (q) {
    banks = banks.filter(
      (o) => o.ticker.toLowerCase().includes(q) || (o.name || "").toLowerCase().includes(q)
    );
  }

  const counts = {
    all: snap.originators.length,
    strong: snap.originators.filter((o) => statusFor(o) === "strong").length,
    watching: snap.originators.filter((o) => statusFor(o) === "watching").length,
    quiet: snap.originators.filter((o) => statusFor(o) === "quiet").length,
  };

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-6xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Banks</h1>
        <p className="mt-2 text-[color:var(--color-fg-dim)]">
          Every US bank in your seed list. Click one to see filings, signals, and news.
        </p>
      </header>

      <form className="mb-6 flex items-center gap-3 flex-wrap" action="/app/banks">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search ticker or name…"
          className="bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] px-4 py-2.5 text-[14px] flex-1 min-w-[220px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
        <button
          type="submit"
          className="font-mono text-[11px] tracking-[0.18em] uppercase px-4 py-2.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          Search
        </button>
      </form>

      <nav className="mb-6 flex items-center gap-1 text-[12px] font-mono tracking-[0.18em] uppercase">
        {(["all", "strong", "watching", "quiet"] as Filter[]).map((f) => {
          const active = filter === f;
          const href = `/app/banks?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={f}
              href={href}
              className={`px-3 py-1.5 border transition ${
                active
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
              }`}
            >
              {f} <span className="ml-1 text-[color:var(--color-fg-faint)]">{counts[f]}</span>
            </Link>
          );
        })}
      </nav>

      {banks.length === 0 ? (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
          {q || filter !== "all"
            ? "No banks match this filter."
            : "No banks loaded yet — run the workers."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((o) => {
            const status = statusFor(o);
            const sig = topSignalFor(o.ticker, snap.top_signals);
            const copy = sig ? plainSignal(sig.signal_type) : null;
            return (
              <Link
                key={o.ticker}
                href={`/app/banks/${o.ticker}`}
                className="block p-5 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] hover:bg-[color:var(--color-bg-2)] hover:border-[color:var(--color-line-strong)] transition"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-2xl text-[color:var(--color-accent)]">
                    {o.ticker}
                  </span>
                  <span
                    className={`font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 border ${STATUS_COPY[status].tone}`}
                  >
                    {STATUS_COPY[status].label}
                  </span>
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">
                  {o.name}
                </div>
                <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                  {(o.tier || "—").toUpperCase()}
                </div>
                <div className="mt-4 text-[13px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2 min-h-[2.5em]">
                  {copy?.label || "No high-confidence signal yet"}
                </div>
                <div className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                  <span>{o.signals} signal{o.signals === 1 ? "" : "s"}</span>
                  {o.news_mentions > 0 && (
                    <span className="text-[color:var(--color-warn)]">
                      {o.news_mentions} news
                    </span>
                  )}
                  <span className="ml-auto">{relativeAge(o.last_filed_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
