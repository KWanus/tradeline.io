import Link from "next/link";
import { notFound } from "next/navigation";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import {
  plainSignal,
  relativeAge,
  STATUS_COPY,
  statusFor,
  whyLine,
} from "@/lib/signal-copy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BankDetail({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const o = snap.originators.find((x) => x.ticker === ticker);
  if (!o) notFound();

  const status = statusFor(o);
  const allSignals = snap.top_signals
    .filter((s) => s.ticker === ticker)
    .sort((a, b) => b.confidence - a.confidence);
  const topSig = allSignals[0];
  const filings = snap.recent_filings.filter((f) => f.ticker === ticker).slice(0, 8);
  const news = snap.matched_news.filter((n) => n.matched_tickers?.includes(ticker)).slice(0, 8);

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <Link
        href="/app/banks"
        className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
      >
        &larr; All banks
      </Link>

      <header className="mt-4 mb-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
            {(o.tier || "—").toUpperCase()}
          </div>
          <span
            className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border ${STATUS_COPY[status].tone}`}
          >
            {STATUS_COPY[status].label}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-4 flex-wrap">
          <span className="font-mono text-5xl md:text-6xl text-[color:var(--color-accent)]">
            {o.ticker}
          </span>
          <span className="text-xl md:text-2xl text-[color:var(--color-fg)]">{o.name}</span>
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
          <span>{o.signals} signal{o.signals === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>{o.filings} filing{o.filings === 1 ? "" : "s"} indexed</span>
          {o.news_mentions > 0 && (
            <>
              <span>·</span>
              <span className="text-[color:var(--color-warn)]">
                {o.news_mentions} news mention{o.news_mentions === 1 ? "" : "s"}
              </span>
            </>
          )}
          <span>·</span>
          <span>last activity {relativeAge(o.last_filed_at)}</span>
        </div>
      </header>

      {topSig && (
        <section className="mb-12">
          <SectionLabel>The headline signal</SectionLabel>
          <article className="mt-4 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-7">
            <div className="text-[20px] md:text-[22px] font-medium leading-snug">
              {plainSignal(topSig.signal_type).label}
            </div>
            <p className="mt-2 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
              {whyLine(topSig)}
            </p>
            <div className="mt-6">
              <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
                WHAT YOU&rsquo;D DO NEXT
              </div>
              <p className="mt-2 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {plainSignal(topSig.signal_type).action}
              </p>
            </div>
            {topSig.url && (
              <div className="mt-6">
                <a
                  href={topSig.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition inline-block"
                >
                  Open SEC filing &rarr;
                </a>
              </div>
            )}
          </article>
        </section>
      )}

      {allSignals.length > 1 && (
        <section className="mb-12">
          <SectionLabel>Other signals on this bank</SectionLabel>
          <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {allSignals.slice(1).map((s) => (
              <a
                key={s.source_id}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="block px-5 py-3.5 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[14px] text-[color:var(--color-fg)]">
                      {plainSignal(s.signal_type).label}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[color:var(--color-fg-dim)]">
                      {whyLine(s)}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                    conf {s.confidence.toFixed(2)} · {relativeAge(s.filed_at)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {filings.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Recent SEC filings</SectionLabel>
          <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {filings.map((f) => (
              <a
                key={f.source_id}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline gap-4 px-5 py-3 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)] w-20 shrink-0">
                  {f.filed_at?.slice(0, 10) || "—"}
                </span>
                <span className="font-mono text-[12px] text-[color:var(--color-accent)] w-12 shrink-0">
                  {f.form_type}
                </span>
                <span className="text-[13px] text-[color:var(--color-fg)] truncate flex-1">
                  {f.description || "open"}
                </span>
                <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)] shrink-0">
                  {f.items?.length ? `items ${f.items.join(", ")}` : ""}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section className="mb-12">
          <SectionLabel>News mentions</SectionLabel>
          <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {news.map((n) => (
              <a
                key={n.source_id}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                className="block px-5 py-3.5 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
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

      <section className="mt-10">
        <SectionLabel>External</SectionLabel>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {o.ticker && (
            <a
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${o.ticker}&type=10&dateb=&owner=include&count=40`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              SEC EDGAR profile
            </a>
          )}
          {o.ticker && (
            <a
              href={`https://www.google.com/finance/quote/${o.ticker}:NYSE`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              Stock quote
            </a>
          )}
        </div>
      </section>
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
