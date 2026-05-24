import Link from "next/link";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { plainSignal } from "@/lib/signal-copy";
import { PublicFooter } from "@/app/_components/public-footer";
import { jsonLdScript, newsCollectionLd } from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 50;

export const metadata = {
  title: "Signals · SEC filings across every tracked bank · Tradeline",
  description:
    "Every charge-off / disposition / impairment signal Tradeline scored from SEC EDGAR + XBRL across the 57 tracked banks. Newest first. Each one links straight to the source filing.",
  openGraph: {
    title: "Tradeline signals · scored SEC filings across every tracked bank",
    description:
      "Recent SEC signals matched to the 57 banks on the Tradeline radar.",
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

export default async function PublicSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; form?: string }>;
}) {
  const params = await searchParams;
  const activeTicker = (params.ticker || "").trim().toUpperCase();
  const activeForm = (params.form || "").trim().toUpperCase();

  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const all = snap.top_signals || [];

  // Build counts BEFORE filtering so the chip nav doesn't collapse on
  // narrow views.
  const tickerCounts = new Map<string, number>();
  const formCounts = new Map<string, number>();
  for (const s of all) {
    if (s.ticker) tickerCounts.set(s.ticker, (tickerCounts.get(s.ticker) || 0) + 1);
    if (s.form_type)
      formCounts.set(s.form_type, (formCounts.get(s.form_type) || 0) + 1);
  }
  const topTickers = [...tickerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14);
  const topForms = [...formCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  let filtered = all.slice().sort((a, b) => {
    const ta = new Date(a.filed_at).getTime();
    const tb = new Date(b.filed_at).getTime();
    if ((tb || 0) !== (ta || 0)) return (tb || 0) - (ta || 0);
    return b.confidence - a.confidence;
  });
  if (activeTicker) filtered = filtered.filter((s) => s.ticker === activeTicker);
  if (activeForm) filtered = filtered.filter((s) => s.form_type === activeForm);
  const visible = filtered.slice(0, DEFAULT_LIMIT);
  const truncated = filtered.length > visible.length;

  // Build the chip URL preserving the OTHER filter.
  const tickerUrl = (t?: string) => {
    const q = new URLSearchParams();
    if (t) q.set("ticker", t);
    if (activeForm) q.set("form", activeForm);
    const qs = q.toString();
    return `/signals${qs ? `?${qs}` : ""}`;
  };
  const formUrl = (f?: string) => {
    const q = new URLSearchParams();
    if (activeTicker) q.set("ticker", activeTicker);
    if (f) q.set("form", f);
    const qs = q.toString();
    return `/signals${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          newsCollectionLd({
            totalHeadlines: filtered.length,
            tickerCount: tickerCounts.size,
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
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#0a0c14] font-semibold text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-semibold text-[18px]">Tradeline</span>
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
          Signals
          {(activeTicker || activeForm) && (
            <>
              {" · "}
              <span className="text-[color:var(--color-accent)]">
                {[activeTicker, activeForm].filter(Boolean).join(" · ")}
              </span>
            </>
          )}
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          Scored SEC filings on{" "}
          <span className="italic text-gradient-accent">tracked banks.</span>
        </h1>
        <p className="mt-5 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          {filtered.length} signal{filtered.length === 1 ? "" : "s"} indexed
          across {tickerCounts.size} bank
          {tickerCounts.size === 1 ? "" : "s"}. Pulled every 6 hours from SEC
          EDGAR + XBRL charge-off concepts; scored by recency + confidence.
          {(activeTicker || activeForm) && (
            <>
              {" "}
              <Link
                href="/signals"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                Clear filters
              </Link>
            </>
          )}
        </p>

        {/* Form type chips */}
        {topForms.length > 0 && (
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
              Form type
            </div>
            <nav className="flex items-center gap-2 flex-wrap">
              <Link
                href={formUrl()}
                className={`font-mono text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 rounded border transition ${
                  !activeForm
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                }`}
              >
                All
              </Link>
              {topForms.map(([form, count]) => (
                <Link
                  key={form}
                  href={formUrl(form)}
                  className={`font-mono text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 rounded border transition ${
                    activeForm === form
                      ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                      : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                  }`}
                >
                  {form}{" "}
                  <span className="ml-1 text-[color:var(--color-fg-faint)]">
                    {count}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Ticker chips */}
        {topTickers.length > 0 && (
          <div className="mt-4">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
              Bank
            </div>
            <nav className="flex items-center gap-2 flex-wrap">
              <Link
                href={tickerUrl()}
                className={`font-mono text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 rounded border transition ${
                  !activeTicker
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                }`}
              >
                All
              </Link>
              {topTickers.map(([ticker, count]) => (
                <Link
                  key={ticker}
                  href={tickerUrl(ticker)}
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
          </div>
        )}

        {visible.length === 0 ? (
          <section className="mt-10 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            No signals match these filters in the current snapshot. Subscribe
            to{" "}
            <Link
              href="/report"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              /report
            </Link>{" "}
            to be told when this changes.
          </section>
        ) : (
          <section className="mt-8 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)] overflow-hidden">
            {visible.map((s) => {
              const copy = plainSignal(s.signal_type);
              return (
                <article
                  key={s.source_id}
                  className="px-5 py-4 hover:bg-[color:var(--color-bg-2)] transition"
                >
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href={`/banks/${s.ticker}`}
                        className="font-mono text-[16px] text-[color:var(--color-accent)] hover:underline"
                      >
                        {s.ticker}
                      </Link>
                      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                        {s.form_type}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
                        {relativeAge(s.filed_at)} · {fmtDate(s.filed_at)}
                      </span>
                      {s.source === "sec_xbrl" &&
                        typeof s.yoy_pct === "number" && (
                          <span
                            className={`font-mono text-[11px] ${
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
                      EDGAR &nearr;
                    </a>
                  </div>
                  <div className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
                    {copy.label}
                  </div>
                  {s.excerpt && (
                    <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed line-clamp-2">
                      {s.excerpt}
                    </p>
                  )}
                  <div className="mt-1.5 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
                    confidence {s.confidence.toFixed(2)}
                    {s.concept && ` · ${s.concept}`}
                  </div>
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
            href={(() => {
              const q = new URLSearchParams();
              if (activeTicker) q.set("ticker", activeTicker);
              if (activeForm) q.set("form", activeForm);
              const qs = q.toString();
              return `/signals.csv${qs ? `?${qs}` : ""}`;
            })()}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            CSV &nearr;
          </a>
          <a
            href={(() => {
              const q = new URLSearchParams();
              if (activeTicker) q.set("ticker", activeTicker);
              if (activeForm) q.set("form", activeForm);
              const qs = q.toString();
              return `/api/signals${qs ? `?${qs}` : ""}`;
            })()}
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
            Get the weekly synthesis Monday morning.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto leading-relaxed">
            Tradeline scores these filings + matched news + court dockets and
            ranks the 57 tracked banks every Monday. Free. No paywall. No
            consumer data.
          </p>
          <div className="mt-5">
            <Link
              href="/report"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#0a0c14] hover:opacity-90 transition inline-block"
              style={{ background: "var(--gradient-primary)" }}
            >
              Subscribe &rarr;
            </Link>
          </div>
        </section>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          Snapshot generated {snap.generated_at?.slice(0, 16) || "—"} UTC.
          Signals scored from public SEC filings + XBRL. Source filings link
          directly to EDGAR.
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}
