import Link from "next/link";
import { PageIntro } from "../_components/page-intro";
import { WatchlistStar } from "./[ticker]/_watchlist-star";
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

const FILTER_LABEL: Record<Filter, string> = {
  all: "Show all",
  strong: "Call brokers now",
  watching: "Watch",
  quiet: "Skip for today",
};

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
      <PageIntro
        eyebrow="Daily · scouting"
        title={<>Which banks are about to sell debt?</>}
        lead={
          <>
            These are 31 US banks tracked every day. When a bank&rsquo;s numbers say it
            needs to clear bad debt off its books, you&rsquo;ll see it here first.{" "}
            <strong className="text-[color:var(--color-accent)]">Green</strong> means
            call brokers this week.{" "}
            <strong className="text-[color:var(--color-warn)]">Yellow</strong> means
            keep watching. Gray means skip for today.
          </>
        }
        doNow={
          counts.strong > 0 ? (
            <>
              <strong>{counts.strong} {counts.strong === 1 ? "bank is" : "banks are"} green right now.</strong>{" "}
              Click the &ldquo;Call brokers now&rdquo; chip below to see which.
            </>
          ) : (
            <>
              Nothing green yet today. Open &ldquo;Watch&rdquo; to see what&rsquo;s
              brewing for next week.
            </>
          )
        }
        howThisWorks={
          <>
            <p>
              A worker reads each bank&rsquo;s public SEC filings (10-Q, 10-K, 8-K)
              every day, plus news headlines that mention the bank.
            </p>
            <p>
              It compares this quarter&rsquo;s loan-loss numbers to last year&rsquo;s.
              Big jumps mean the bank is sitting on debt it needs to clear — usually
              by selling a portfolio to buyers like you.
            </p>
            <p>
              <strong className="text-[color:var(--color-accent)]">Green</strong>{" "}
              (Call brokers now): the math is strong. Sale window 1–2 quarters out.{" "}
              <strong className="text-[color:var(--color-warn)]">Yellow</strong>{" "}
              (Watch): something is moving. 2–4 quarters out. <strong>Gray</strong>{" "}
              (Skip): nothing yet — check back tomorrow.
            </p>
            <p>
              Click any card → see the actual filings, the financial deltas, and a
              suggested broker to contact.
            </p>
          </>
        }
      />

      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-2.5">
        <div className="text-[13px] text-[color:var(--color-fg-dim)] flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[color:var(--color-accent)] glow" />
          <span>
            <strong className="text-[color:var(--color-fg)]">Auto-scanner</strong> runs every 6
            hours — finds new banks via SEC&rsquo;s live 8-K feed.
            {(snap.summary.auto_discovered_count || 0) > 0 && (
              <>
                {" "}
                <strong className="text-[color:var(--color-accent)]">
                  {snap.summary.auto_discovered_count} promoted
                </strong>
                .
              </>
            )}
            {(snap.summary.pending_candidates || 0) > 0 && (
              <>
                {" "}
                <strong className="text-[color:var(--color-warn)]">
                  {snap.summary.pending_candidates} pending review
                </strong>
                .
              </>
            )}
          </span>
        </div>
        <Link
          href="/app/banks/discovered"
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          View discovered →
        </Link>
      </div>

      <form className="mb-6 flex items-center gap-3 flex-wrap" action="/app/banks">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by ticker or bank name…"
          className="bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] px-4 py-2.5 text-[14px] flex-1 min-w-[220px] rounded-md focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
        <button
          type="submit"
          className="font-mono text-[11px] tracking-[0.18em] uppercase px-4 py-2.5 rounded-md border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          Search
        </button>
      </form>

      <nav className="mb-6 flex items-center gap-2 flex-wrap text-[12px]">
        {(["all", "strong", "watching", "quiet"] as Filter[]).map((f) => {
          const active = filter === f;
          const href = `/app/banks?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          const tone =
            f === "strong"
              ? "data-tone-strong"
              : f === "watching"
                ? "data-tone-watching"
                : "";
          return (
            <Link
              key={f}
              href={href}
              data-tone={tone}
              className={`px-3.5 py-1.5 rounded-md border transition flex items-center gap-2 ${
                active
                  ? f === "strong"
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : f === "watching"
                      ? "border-[color:var(--color-warn)] text-[color:var(--color-warn)]"
                      : "border-[color:var(--color-fg-dim)] text-[color:var(--color-fg)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
              }`}
            >
              <span>{FILTER_LABEL[f]}</span>
              <span className="text-[color:var(--color-fg-faint)] font-mono">
                {counts[f]}
              </span>
            </Link>
          );
        })}
      </nav>

      {banks.length === 0 ? (
        <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
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
                className="block p-5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] hover:bg-[color:var(--color-bg-2)] hover:border-[color:var(--color-line-strong)] transition"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl text-[color:var(--color-accent)]">
                      {o.ticker}
                    </span>
                    {o.auto_discovered && (
                      <span
                        title="Auto-discovered by the SEC EDGAR scanner — not on the human-curated list."
                        className="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] border border-[color:var(--color-accent-dim)]"
                      >
                        Auto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <WatchlistStar ticker={o.ticker} size="sm" />
                    <span
                      className={`font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border ${STATUS_COPY[status].tone}`}
                    >
                      {STATUS_COPY[status].label}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">
                  {o.name}
                </div>
                <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                  {(o.tier || "—").toUpperCase()}
                </div>
                <div className="mt-4 text-[13px] text-[color:var(--color-fg)] leading-snug line-clamp-2 min-h-[2.5em]">
                  {copy?.label || "No strong signal yet"}
                </div>
                {copy?.action && status !== "quiet" && (
                  <div className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2">
                    <span className="text-[color:var(--color-accent)] font-mono text-[10px] tracking-[0.18em] uppercase mr-1.5">
                      Do
                    </span>
                    {copy.action}
                  </div>
                )}
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
