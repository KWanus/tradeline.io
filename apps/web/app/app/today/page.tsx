import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import {
  plainSignal,
  relativeAge,
  STATUS_COPY,
  statusFor,
  topSignalFor,
  whyLine,
} from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FRIENDLY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default async function TodayPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const strong = snap.originators.filter((o) => statusFor(o) === "strong");
  const primary = strong[0];
  const others = strong.slice(1, 4);
  const watching = snap.originators
    .filter((o) => statusFor(o) === "watching")
    .slice(0, 5);
  const recentNews = snap.matched_news.slice(0, 4);

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            {FRIENDLY_DATE.format(new Date())}
          </div>
          <Link
            href="/app/learn"
            className="font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            New here? Read this first &rarr;
          </Link>
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-medium tracking-tight">
          {primary
            ? "One bank stands out today."
            : strong.length === 0 && watching.length === 0
            ? "Quiet morning. Nothing flagged."
            : "Things are warming up."}
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl">
          {primary ? (
            <>
              Tracking <span className="text-[color:var(--color-fg)]">{snap.summary.originators_with_filings}</span>{" "}
              banks. <span className="text-[color:var(--color-fg)]">{strong.length}</span> showing strong distress;{" "}
              <span className="text-[color:var(--color-fg)]">{watching.length}</span> worth watching.
            </>
          ) : (
            "All quiet on the public-source feeds. Check back tomorrow."
          )}
        </p>
      </header>

      {primary && <Hero o={primary} sig={topSignalFor(primary.ticker, snap.top_signals)} />}

      {others.length > 0 && (
        <section className="mt-12">
          <SectionLabel>Also showing strong signal</SectionLabel>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {others.map((o) => (
              <SecondaryCard
                key={o.ticker}
                ticker={o.ticker}
                name={o.name || ""}
                tier={o.tier || ""}
                signal={topSignalFor(o.ticker, snap.top_signals)}
                newsMentions={o.news_mentions}
              />
            ))}
          </div>
        </section>
      )}

      {watching.length > 0 && (
        <section className="mt-12">
          <SectionLabel>Worth watching</SectionLabel>
          <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {watching.map((o) => (
              <Link
                key={o.ticker}
                href={`/app/banks/${o.ticker}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <span className="font-mono text-[15px] text-[color:var(--color-accent)] w-14">
                  {o.ticker}
                </span>
                <span className="text-[14px] text-[color:var(--color-fg)] flex-1 truncate">
                  {o.name}
                </span>
                <span className="text-[13px] text-[color:var(--color-fg-dim)] hidden md:block flex-1 truncate">
                  {plainSignal(topSignalFor(o.ticker, snap.top_signals)?.signal_type || "unspecified").label}
                </span>
                <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.18em]">
                  {relativeAge(o.last_filed_at)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentNews.length > 0 && (
        <section className="mt-12">
          <SectionLabel>Recent news on your banks</SectionLabel>
          <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {recentNews.map((n) => (
              <a
                key={n.source_id}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                className="block px-5 py-3.5 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                  <span className="text-[color:var(--color-accent)]">
                    {(n.matched_tickers || []).join(" · ")}
                  </span>
                  <span>{relativeAge(n.published_at)}</span>
                  {n.publisher && <span className="ml-auto truncate max-w-[40%]">{n.publisher}</span>}
                </div>
                <div className="mt-1 text-[14px] text-[color:var(--color-fg)] truncate">
                  {n.title}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed max-w-2xl">
        Public sources only. Zero consumer data. This radar tells you which banks may divest debt
        portfolios — actual purchase requires a state license, a bond, broker relationships, and
        wired funds. None of those happen in a browser.
      </p>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
      {children}
    </div>
  );
}

function Hero({
  o,
  sig,
}: {
  o: RadarSnapshot["originators"][number];
  sig: ReturnType<typeof topSignalFor>;
}) {
  const status = statusFor(o);
  const copy = sig ? plainSignal(sig.signal_type) : null;
  return (
    <article className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-7 md:p-10 relative">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
          {(o.tier || "—").toUpperCase()}
        </div>
        <span
          className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border ${STATUS_COPY[status].tone}`}
        >
          {STATUS_COPY[status].label}
        </span>
      </div>

      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="font-mono text-5xl text-[color:var(--color-accent)]">{o.ticker}</span>
        <span className="text-xl text-[color:var(--color-fg)]">{o.name}</span>
      </div>

      <div className="mt-7 max-w-2xl">
        <div className="text-[20px] md:text-[22px] font-medium text-[color:var(--color-fg)] leading-snug">
          {copy?.label || "Filing activity"}
        </div>
        <p className="mt-2 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {whyLine(sig)}
        </p>
      </div>

      {copy && (
        <div className="mt-7 max-w-2xl">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
            WHAT YOU&rsquo;D DO NEXT
          </div>
          <p className="mt-2 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {copy.action}
          </p>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <Link
          href={`/app/banks/${o.ticker}`}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          See everything on {o.ticker}
        </Link>
        {sig?.url && (
          <a
            href={sig.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line-strong)] text-[color:var(--color-fg)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Open SEC filing &rarr;
          </a>
        )}
      </div>
    </article>
  );
}

function SecondaryCard({
  ticker,
  name,
  tier,
  signal,
  newsMentions,
}: {
  ticker: string;
  name: string;
  tier: string;
  signal: ReturnType<typeof topSignalFor>;
  newsMentions: number;
}) {
  const copy = signal ? plainSignal(signal.signal_type) : null;
  return (
    <Link
      href={`/app/banks/${ticker}`}
      className="block p-5 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] hover:bg-[color:var(--color-bg-2)] hover:border-[color:var(--color-line-strong)] transition"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl text-[color:var(--color-accent)]">{ticker}</span>
        {newsMentions > 0 && (
          <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-warn)]">
            {newsMentions} news
          </span>
        )}
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">{name}</div>
      <div className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2">
        {copy?.label || "Filing activity"}
      </div>
    </Link>
  );
}
