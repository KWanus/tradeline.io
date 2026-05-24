import Link from "next/link";
import { notFound } from "next/navigation";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor } from "@/lib/signal-copy";
import { PublicFooter } from "@/app/_components/public-footer";
import {
  bankArticleLd,
  bankBreadcrumbLd,
  jsonLdScript,
} from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_COPY: Record<
  string,
  { label: string; tone: "strong" | "warn" | "quiet"; description: string }
> = {
  strong: {
    label: "Strong",
    tone: "strong",
    description:
      "Multiple credit-quality signals firing this week. Distress visible in public filings.",
  },
  watching: {
    label: "Watching",
    tone: "warn",
    description:
      "Some early indicators. Worth tracking; not yet a confirmed divestiture signal.",
  },
  quiet: {
    label: "Quiet",
    tone: "quiet",
    description:
      "Within normal credit-quality bands. Tradeline still scans this name every 6 hours.",
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

export async function generateStaticParams() {
  // Pre-render every tracked bank at build time. Snapshot is read fresh on
  // each render anyway (force-dynamic), but listing the tickers here lets
  // Next.js generate the routes for sitemap discovery + warm-cache builds.
  try {
    const snap = await readSnapshot();
    return (snap.originators || []).map((o) => ({ ticker: o.ticker }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const o = snap.originators.find((x) => x.ticker === ticker);
  const name = o?.name || ticker;
  const status = o ? statusFor(o) : "quiet";

  const title = `${name} (${ticker}) · charge-off signal · Tradeline`;
  const description = o
    ? `${name} is currently ${STATUS_COPY[status]?.label || "tracked"} on the Tradeline radar — ${o.signals} signals + ${o.news_mentions} news mentions scored from public filings.`
    : `Tradeline scores ${ticker} every 6 hours for non-performing-loan divestiture signals.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article" as const,
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
    },
  };
}

export default async function PublicBankPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const originator = snap.originators.find((o) => o.ticker === ticker);
  if (!originator) {
    notFound();
  }

  const status = statusFor(originator);
  const statusCopy = STATUS_COPY[status] || STATUS_COPY.quiet;
  const name = originator.name || ticker;

  // Pull this bank's signals + news from the snapshot
  const signals = snap.top_signals
    .filter((s) => s.ticker === ticker)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
  const news = snap.matched_news
    .filter((n) => (n.matched_tickers || []).includes(ticker))
    .slice(0, 5);

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          bankArticleLd({
            ticker,
            name,
            status: statusCopy.label,
            confidence: originator.max_confidence,
            signalCount: originator.signals,
            newsCount: originator.news_mentions,
            lastFiledAt: originator.last_filed_at,
          })
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(bankBreadcrumbLd({ ticker, name }))}
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
        <div className="flex items-center gap-3">
          <Link
            href="/coverage"
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            All banks &rarr;
          </Link>
          <Link
            href="/report"
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
          >
            Subscribe &rarr;
          </Link>
        </div>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/coverage"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
        >
          &larr; All tracked banks
        </Link>

        <div className="mt-6 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[32px] md:text-[42px] tracking-[0.05em] text-[color:var(--color-accent)] leading-none">
              {ticker}
            </div>
            <h1 className="mt-2 font-serif text-3xl md:text-5xl tracking-tight leading-[1.05]">
              {name}
            </h1>
          </div>
          <span
            className={`font-mono text-[11px] tracking-[0.22em] uppercase px-3 py-1.5 rounded border ${
              statusCopy.tone === "strong"
                ? "border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                : statusCopy.tone === "warn"
                  ? "border-[color:var(--color-warn)] text-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]"
                  : "border-[color:var(--color-line-strong)] text-[color:var(--color-fg-faint)]"
            }`}
          >
            {statusCopy.label}
          </span>
        </div>

        <p className="mt-4 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          {statusCopy.description}
        </p>

        <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)] rounded-lg overflow-hidden">
          <Stat
            label="Confidence"
            value={originator.max_confidence.toFixed(2)}
            tone={status === "strong" ? "accent" : "default"}
          />
          <Stat label="Filings" value={originator.filings.toString()} />
          <Stat label="Signals" value={originator.signals.toString()} />
          <Stat label="News" value={originator.news_mentions.toString()} />
        </section>

        <section className="mt-6 flex items-center gap-3 flex-wrap text-[12px] font-mono text-[color:var(--color-fg-faint)]">
          {originator.tier && (
            <span className="px-2 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]">
              Tier: {originator.tier}
            </span>
          )}
          <span>Last filing: {fmtDate(originator.last_filed_at)} ({relativeAge(originator.last_filed_at)})</span>
          {originator.auto_discovered && (
            <span className="px-2 py-0.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] tracking-[0.18em] uppercase text-[9px]">
              Auto-discovered
            </span>
          )}
        </section>

        {/* Signals */}
        {signals.length > 0 && (
          <section className="mt-10">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)] mb-3">
              What the signals say
            </div>
            <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
              {signals.map((s) => {
                const copy = plainSignal(s.signal_type);
                return (
                  <div key={s.source_id} className="px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div className="text-[14px] text-[color:var(--color-fg)]">
                        {copy.label}
                        {s.source === "sec_xbrl" &&
                          typeof s.yoy_pct === "number" && (
                            <span
                              className={`ml-2 font-mono text-[11px] ${
                                s.yoy_pct >= 100
                                  ? "text-[color:var(--color-danger)]"
                                  : "text-[color:var(--color-warn)]"
                              }`}
                            >
                              {s.yoy_pct >= 0 ? "+" : ""}
                              {s.yoy_pct.toFixed(0)}% YoY
                            </span>
                          )}
                      </div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline shrink-0"
                      >
                        {s.form_type} &nearr;
                      </a>
                    </div>
                    {s.excerpt && (
                      <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed line-clamp-2">
                        {s.excerpt}
                      </p>
                    )}
                    <div className="mt-1.5 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
                      filed {fmtDate(s.filed_at)} · confidence {s.confidence.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* News */}
        {news.length > 0 && (
          <section className="mt-10">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)] mb-3">
              In the news
            </div>
            <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
              {news.map((n) => (
                <a
                  key={n.source_id}
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block px-5 py-3 hover:bg-[color:var(--color-bg-2)] transition"
                >
                  <div className="text-[14px] text-[color:var(--color-fg)]">
                    {n.title}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
                    {n.publisher} · {relativeAge(n.published_at)}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {signals.length === 0 && news.length === 0 && (
          <section className="mt-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-8 text-center text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            No fresh signals or matched news for {ticker} this week.
            That&rsquo;s its own signal — most weeks most banks are quiet.
            Subscribe to <Link href="/report" className="text-[color:var(--color-accent)] hover:underline">/report</Link> to be told when this changes.
          </section>
        )}

        {/* CTA */}
        <section className="mt-12 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-8 text-center">
          <h2 className="font-serif text-2xl tracking-tight">
            Get {name} in your inbox when it moves.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto leading-relaxed">
            Subscribe to the Tradeline weekly Charge-Off Report. Free. Every
            Monday: which banks are showing distress in their public filings,
            scored. Includes {ticker} every week.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/report"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#0a0c14] hover:opacity-90 transition inline-block"
              style={{ background: "var(--gradient-primary)" }}
            >
              Subscribe &rarr;
            </Link>
            <Link
              href="/about"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition inline-block"
            >
              How this works
            </Link>
          </div>
        </section>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          Snapshot generated {snap.generated_at?.slice(0, 16) || "—"} UTC.
          Public-source data only. Zero consumer information.
          {" · "}
          <a
            href={`/api/banks/${ticker}`}
            className="text-[color:var(--color-accent)] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            JSON &nearr;
          </a>
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "default";
}) {
  const color =
    tone === "accent"
      ? "text-[color:var(--color-accent)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl ${color}`}>{value}</div>
    </div>
  );
}
