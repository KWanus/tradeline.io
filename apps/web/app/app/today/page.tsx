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
      <header className="mb-12">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-[12px] text-[color:var(--color-fg-faint)] tracking-wide">
            {FRIENDLY_DATE.format(new Date())}
          </div>
          <Link
            href="/app/learn"
            className="text-[12px] px-3 py-1.5 rounded-md border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            New here? Read this first &rarr;
          </Link>
        </div>
        <h1 className="mt-4 font-serif text-5xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
          {primary ? (
            <>
              One bank{" "}
              <span className="italic text-[color:var(--color-accent)]">stands out</span>{" "}
              today.
            </>
          ) : strong.length === 0 && watching.length === 0 ? (
            <>
              Quiet morning. <span className="italic">Nothing flagged.</span>
            </>
          ) : (
            <>
              Things are <span className="italic text-[color:var(--color-warn)]">warming up</span>.
            </>
          )}
        </h1>
        <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-2xl">
          {primary ? (
            <>
              Tracking{" "}
              <span className="text-[color:var(--color-fg)] font-medium">
                {snap.summary.originators_with_filings}
              </span>{" "}
              banks.{" "}
              <span className="text-[color:var(--color-fg)] font-medium">
                {strong.length}
              </span>{" "}
              showing strong distress;{" "}
              <span className="text-[color:var(--color-fg)] font-medium">
                {watching.length}
              </span>{" "}
              worth watching.
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
    <div className="font-serif italic text-[18px] text-[color:var(--color-fg-dim)] mb-1">
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
    <article className="card-elevated p-7 md:p-10 relative overflow-hidden">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[color:var(--color-accent-soft)] opacity-30 blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          {o.tier || "—"}
        </div>
        <span
          className={`badge ${STATUS_COPY[status].tone}`}
        >
          {STATUS_COPY[status].label}
        </span>
      </div>

      <div className="relative flex items-baseline gap-4 flex-wrap">
        <span className="font-mono text-5xl md:text-6xl text-[color:var(--color-accent)] tracking-tight">
          {o.ticker}
        </span>
        <span className="font-serif italic text-2xl md:text-3xl text-[color:var(--color-fg)]">
          {o.name}
        </span>
      </div>

      <div className="relative mt-8 max-w-2xl">
        <div className="font-serif text-[26px] md:text-[30px] tracking-tight text-[color:var(--color-fg)] leading-tight">
          {copy?.label || "Filing activity"}
        </div>
        <p className="mt-3 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {whyLine(sig)}
        </p>
      </div>

      {copy && (
        <div className="relative mt-8 max-w-2xl">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            What you&rsquo;d do next
          </div>
          <p className="mt-2 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {copy.action}
          </p>
        </div>
      )}

      <div className="relative mt-10 flex items-center gap-3 flex-wrap">
        <Link
          href={`/app/banks/${o.ticker}`}
          className="btn-primary"
        >
          See everything on {o.ticker}
        </Link>
        {sig?.url && (
          <a
            href={sig.url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
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
      className="block p-5 card lift-on-hover"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl text-[color:var(--color-accent)]">{ticker}</span>
        {newsMentions > 0 && (
          <span className="text-[11px] text-[color:var(--color-warn)]">
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
