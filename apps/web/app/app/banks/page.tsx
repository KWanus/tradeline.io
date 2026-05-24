import Link from "next/link";
import { EmptyState } from "../_components/empty-state";
import { PageHeader, type PageHeaderTab } from "../_components/page-header";
import { HighlightCardWrapper, RecommendedSection } from "../_components/recommended";
import { StatCard } from "../_components/stat-card";
import { CommunityBanksSection } from "./_community-banks";
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

  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : "";
  const tabs: PageHeaderTab[] = [
    {
      label: `All · ${counts.all}`,
      href: q ? `/app/banks?q=${encodeURIComponent(q)}` : "/app/banks",
      active: filter === "all",
    },
    {
      label: `Strong · ${counts.strong}`,
      href: `/app/banks?filter=strong${qSuffix}`,
      active: filter === "strong",
    },
    {
      label: `Watch · ${counts.watching}`,
      href: `/app/banks?filter=watching${qSuffix}`,
      active: filter === "watching",
    },
    {
      label: `Quiet · ${counts.quiet}`,
      href: `/app/banks?filter=quiet${qSuffix}`,
      active: filter === "quiet",
    },
  ];

  const autoCount = snap.summary.auto_discovered_count || 0;
  const pendingCount = snap.summary.pending_candidates || 0;

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-6xl">
      <PageHeader
        icon={<span aria-hidden>▦</span>}
        title="Banks"
        badge={{ label: "Live", tone: "success" }}
        tagline={
          counts.strong > 0
            ? `${counts.all} banks tracked. ${counts.strong} ready for outreach, ${counts.watching} worth watching.`
            : `${counts.all} banks tracked. Nothing strong yet — ${counts.watching} on the watch list.`
        }
        tabs={tabs}
        meta={
          <Link
            href="/app/banks/discovered"
            title="Auto-scanner runs every 6h via SEC EDGAR live feed."
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-success)] glow" />
            Auto-scanner
            {autoCount > 0 && (
              <span className="text-[color:var(--color-accent)]">
                · +{autoCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-[color:var(--color-warn)]">
                · {pendingCount} review
              </span>
            )}
          </Link>
        }
      />

      <div className="stagger-fade grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard value={counts.all} label="Banks tracked" />
        <StatCard
          value={counts.strong}
          label="Ready"
          tone="success"
          delta={counts.strong > 0 ? "call brokers" : "—"}
        />
        <StatCard
          value={counts.watching}
          label="Watching"
          tone="warn"
          delta={counts.watching > 0 ? "trending up" : "—"}
        />
        <StatCard
          value={autoCount}
          label="Auto-found"
          tone="accent"
          delta={autoCount > 0 ? "last 90 days" : "scanner idle"}
          href="/app/banks/discovered"
        />
      </div>

      {filter === "all" && !q && (
        <RecommendedSection
          label="Call brokers now"
          title={
            <>
              {counts.strong} bank{counts.strong === 1 ? "" : "s"} ready for outreach this week.
            </>
          }
          subtitle="Highest-confidence signals. Click any card → 4-step playbook auto-fills your outreach email."
          count={counts.strong}
          empty={
            <>
              Nothing green today. Open the <strong>Watch</strong> filter below to see what&rsquo;s
              brewing for next week.
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {snap.originators
              .filter((o) => statusFor(o) === "strong")
              .slice(0, 6)
              .map((o) => {
                const sig = topSignalFor(o.ticker, snap.top_signals);
                const copy = sig ? plainSignal(sig.signal_type) : null;
                return (
                  <HighlightCardWrapper key={o.ticker}>
                    <Link
                      href={`/app/banks/${o.ticker}`}
                      className="block p-5 rounded-xl bg-[color:var(--color-bg-1)] hover:bg-[color:var(--color-bg-2)] transition group"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-2xl text-[color:var(--color-accent)]">
                            {o.ticker}
                          </span>
                          {o.auto_discovered && (
                            <span className="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] border border-[color:var(--color-accent-dim)]">
                              Auto
                            </span>
                          )}
                        </div>
                        <span
                          className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full text-[#0a0c14] font-semibold"
                          style={{ background: "var(--gradient-primary)" }}
                        >
                          Call now
                        </span>
                      </div>
                      <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">
                        {o.name}
                      </div>
                      <div className="mt-3 text-[13px] text-[color:var(--color-fg)] leading-snug line-clamp-2 min-h-[2.5em]">
                        {copy?.label || "Filing activity"}
                      </div>
                      {copy?.action && (
                        <div className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2">
                          <span className="font-mono text-[10px] tracking-[0.18em] uppercase mr-1.5 text-[color:var(--color-accent)]">
                            Do
                          </span>
                          {copy.action}
                        </div>
                      )}
                      <div className="mt-4 flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                        <span>Open playbook →</span>
                        <span>{o.signals} signal{o.signals === 1 ? "" : "s"}</span>
                      </div>
                    </Link>
                  </HighlightCardWrapper>
                );
              })}
          </div>
        </RecommendedSection>
      )}

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

      {banks.length === 0 ? (
        q || filter !== "all" ? (
          <EmptyState
            icon="◌"
            title="No banks match this filter"
            description={
              q
                ? `Nothing found for "${q}". Try a different search or clear filters.`
                : "Switch tabs above to see banks in other states."
            }
            tone="default"
            primary={{ label: "Show all banks", href: "/app/banks" }}
          />
        ) : (
          <EmptyState
            icon="⟳"
            title="No banks loaded yet"
            description="The radar runs every 6 hours. First sync usually completes within an hour of going live."
            tone="waiting"
            secondary={{ label: "How the scanner works", href: "/app/learn#scanner" }}
          />
        )
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
                className="card lift-on-hover block p-5"
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

      {filter === "all" && !q && (
        <CommunityBanksSection
          fdicSignals={snap.fdic_signals || []}
          ncuaSignals={snap.ncua_signals || []}
        />
      )}
    </main>
  );
}
