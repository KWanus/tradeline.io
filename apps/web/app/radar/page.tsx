import Link from "next/link";
import {
  EMPTY_SNAPSHOT,
  type CourtSignal,
  type NewsSignal,
  type Originator,
  type RadarSnapshot,
  type SecSignal,
  readSnapshot,
} from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------------------------------------------------------------------------
// plain-English translation of the signal vocabulary
// ---------------------------------------------------------------------------

type SignalCopy = { label: string; meaning: string; action: string };

const SIGNAL_COPY: Record<string, SignalCopy> = {
  charge_off_increase: {
    label: "Loan losses accelerating",
    meaning: "More loans went bad this year than last year.",
    action: "Bank likely to package these into a portfolio sale within 1–2 quarters. Watch for broker memos.",
  },
  npl_ratio_increase: {
    label: "Non-performing loans rising",
    meaning: "More borrowers stopped paying than a year ago.",
    action: "Bank under pressure — divestiture window typically opens 2–4 quarters out.",
  },
  reserve_build: {
    label: "Bank bracing for more losses",
    meaning: "Setting aside extra money to absorb expected credit losses.",
    action: "Early signal. Tape availability often follows in 2–4 quarters.",
  },
  portfolio_sale_announced: {
    label: "Sale already announced",
    meaning: "Bank officially disclosed a portfolio disposition (8-K item 2.01).",
    action: "Late-stage. Reach out to brokers (NLEX, Garnet, RMG) about access.",
  },
  divestiture_announced: {
    label: "Divestiture event",
    meaning: "Bank announced exiting part of its business.",
    action: "Open the 8-K — which asset class are they exiting?",
  },
  guidance_change: {
    label: "Outlook changed",
    meaning: "Bank revised its forward guidance to investors.",
    action: "Watch follow-on filings for credit-quality detail.",
  },
  unspecified: {
    label: "Quarterly report posted",
    meaning: "Routine 10-Q or 10-K filed; worth a look at MD&A.",
    action: "Open the filing if this bank is already on your watch list.",
  },
};

function plainSignal(type: string): SignalCopy {
  return SIGNAL_COPY[type] || {
    label: type.replace(/_/g, " "),
    meaning: "Signal recorded.",
    action: "Check the source filing for context.",
  };
}

function confidenceLabel(c: number): { word: string; tone: "strong" | "watch" | "light" } {
  if (c >= 0.8) return { word: "Strong signal", tone: "strong" };
  if (c >= 0.5) return { word: "Worth watching", tone: "watch" };
  return { word: "Light signal", tone: "light" };
}

const TONE_STYLE: Record<"strong" | "watch" | "light", string> = {
  strong: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  watch: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  light: "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]",
};

function relativeAge(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso.slice(0, 10);
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} months ago`;
}

// pick the highest-confidence signal for a ticker so we can write the card
function topSignalFor(ticker: string, signals: SecSignal[]): SecSignal | undefined {
  return signals
    .filter((s) => s.ticker === ticker)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

// build a single-sentence "why" line for an originator card
function whyLine(o: Originator, sig?: SecSignal): string {
  if (!sig) return "Filing activity logged but no high-confidence signal yet.";
  if (sig.source === "sec_xbrl" && typeof sig.yoy_pct === "number") {
    const abs = Math.abs(sig.yoy_pct).toFixed(0);
    const direction = sig.yoy_pct >= 0 ? "up" : "down";
    return `${plainSignal(sig.signal_type).meaning} ${direction.charAt(0).toUpperCase() + direction.slice(1)} ${abs}% year-over-year.`;
  }
  if (sig.items && sig.items.length) {
    return `${plainSignal(sig.signal_type).meaning} (8-K item ${sig.items.join(", ")})`;
  }
  return plainSignal(sig.signal_type).meaning;
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default async function RadarPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {
    snap = EMPTY_SNAPSHOT;
  }

  const isEmpty =
    snap.summary.filings_total === 0 && snap.summary.news_signals_total === 0;
  const watchList = snap.originators
    .filter((o) => o.signals > 0 && o.max_confidence >= 0.5)
    .slice(0, 5);
  const otherActive = snap.originators
    .filter((o) => o.signals > 0 && o.max_confidence >= 0.5)
    .slice(5, 12);

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      {/* nav */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
          <div className="h-2 w-2 rounded-full bg-[color:var(--color-accent)] glow" />
          <span className="font-mono text-sm tracking-[0.2em]">TRADELINE</span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-fg-faint)] border border-[color:var(--color-line)] px-2 py-0.5">
            YOUR&nbsp;WORKBASE
          </span>
        </Link>
        <div className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-fg-faint)]">
          {snap.generated_at
            ? `DATA REFRESHED ${relativeAge(snap.generated_at)}`
            : "NO DATA YET"}
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* HERO — TODAY'S WATCH LIST */}
          <section className="relative z-10 mx-auto max-w-6xl px-6 pt-8 pb-12">
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
                {watchList.length > 0
                  ? `${watchList.length} bank${watchList.length === 1 ? "" : "s"} need${watchList.length === 1 ? "s" : ""} your attention today`
                  : "Quiet day. No high-confidence signals."}
              </h1>
              <div className="font-mono text-[11px] tracking-[0.2em] text-[color:var(--color-fg-faint)]">
                FROM&nbsp;{snap.summary.originators_with_filings}&nbsp;BANKS&nbsp;TRACKED
              </div>
            </div>
            <p className="text-[color:var(--color-fg-dim)] mb-8 max-w-3xl">
              Each card below is a US bank showing real distress in their public filings. The "why" is plain
              English; the recommended next step is what a licensed buyer would actually do.
            </p>

            {watchList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
                {watchList.map((o) => {
                  const sig = topSignalFor(o.ticker, snap.top_signals);
                  return <WatchCard key={o.ticker} o={o} sig={sig} />;
                })}
              </div>
            )}
          </section>

          {/* OTHER ACTIVE NAMES */}
          {otherActive.length > 0 && (
            <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12">
              <SectionHeader label="Other names showing signal" />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
                {otherActive.map((o) => {
                  const sig = topSignalFor(o.ticker, snap.top_signals);
                  return <CompactCard key={o.ticker} o={o} sig={sig} />;
                })}
              </div>
            </section>
          )}

          {/* WHAT'S NEW STRIP */}
          <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12">
            <SectionHeader label="What's flowing in" />
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <Stat
                label="SEC filings tracked"
                value={snap.summary.filings_total}
                hint="10-Q · 10-K · 8-K"
              />
              <Stat
                label="Signals scored"
                value={snap.summary.sec_signals_total}
                hint="Charge-offs, NPL, reserves"
                tone={snap.summary.sec_signals_total > 0 ? "ok" : "dim"}
              />
              <Stat
                label="News headlines matched"
                value={`${snap.summary.news_signals_matched}/${snap.summary.news_signals_total}`}
                hint="Joined to your seed banks"
                tone={snap.summary.news_signals_matched > 0 ? "ok" : "dim"}
              />
              <Stat
                label="Court hits"
                value={snap.summary.court_signals_total}
                hint="FDCPA, NPL litigation"
                tone={snap.summary.court_signals_total > 0 ? "ok" : "dim"}
              />
            </div>
          </section>

          {/* RECENT NEWS FOR WATCH LIST */}
          {snap.matched_news.length > 0 && (
            <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12">
              <SectionHeader label={`Recent news on your watch list (${snap.summary.news_signals_matched})`} />
              <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
                {snap.matched_news.slice(0, 8).map((n) => (
                  <NewsRow key={n.source_id} n={n} />
                ))}
              </div>
            </section>
          )}

          {/* DETAIL ACCORDIONS */}
          <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 space-y-3">
            <SectionHeader label="Power-user data (click to expand)" />

            <Disclosure summary={`All scored signals (${snap.top_signals.length})`}>
              <SignalsTable signals={snap.top_signals} />
            </Disclosure>

            <Disclosure summary={`All matched news (${snap.matched_news.length})`}>
              <div className="bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
                {snap.matched_news.slice(0, 25).map((n) => (
                  <NewsRow key={n.source_id} n={n} />
                ))}
              </div>
            </Disclosure>

            <Disclosure summary={`Court litigation (${snap.summary.court_signals_total})`}>
              <div className="bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
                {snap.court_signals?.slice(0, 15).map((c) => (
                  <CourtRow key={c.source_id} c={c} />
                ))}
              </div>
            </Disclosure>

            <Disclosure summary={`Latest 30 SEC filings (raw)`}>
              <FilingsTable filings={snap.recent_filings.slice(0, 30)} />
            </Disclosure>
          </section>

          {/* HOW TO READ THIS */}
          <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
            <SectionHeader label="How to use this radar" />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
              <HowCard
                step="01"
                title="Read the watch list at the top"
                body="The 5 banks at the top are the ones with the strongest current distress signals in their public filings. That's your morning call list."
              />
              <HowCard
                step="02"
                title="Click through to the SEC filing"
                body="Each card opens the underlying SEC document. Look at the asset class — credit card vs auto vs CRE — that's what they're likely to divest."
              />
              <HowCard
                step="03"
                title="Coordinate with your broker"
                body="When licensed, you'll work with brokers (NLEX, Garnet, RMG). Tell them you've seen the signal — you're now ahead of the broker memo."
              />
            </div>
            <div className="mt-6 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-5 font-mono text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
              <span className="text-[color:var(--color-warn)]">What this radar does NOT do.</span>{" "}
              It does not let you purchase debt directly — that requires a state license, a bond, broker
              relationships, and KYC, none of which happen in a browser. It does not score individual
              consumers (that would be FCRA territory). It does not generate cold-contact lists for unlicensed
              outreach to banks. It surfaces public-source signals so a licensed buyer (you, in Year 2) can
              act with better timing than competitors who are still reading press releases.
            </div>
          </section>
        </>
      )}

      <footer className="relative z-10 border-t border-[color:var(--color-line)]">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.18em]">
          <div>© 2026 TRADELINE · WORKBASE</div>
          <div>Public sources only · Zero consumer data · No FCRA-regulated processing</div>
        </div>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// pieces
// ---------------------------------------------------------------------------

function WatchCard({ o, sig }: { o: Originator; sig?: SecSignal }) {
  const conf = confidenceLabel(o.max_confidence);
  const copy = sig ? plainSignal(sig.signal_type) : null;
  return (
    <div className="bg-[color:var(--color-bg-1)] p-6 md:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
            {(o.tier || "—").toUpperCase()}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-3xl text-[color:var(--color-accent)]">{o.ticker}</span>
            <span className="text-base text-[color:var(--color-fg)]">{o.name}</span>
          </div>
        </div>
        <span
          className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border ${TONE_STYLE[conf.tone]}`}
        >
          {conf.word}
        </span>
      </div>

      <div className="mt-5">
        <div className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
          WHY IT'S ON YOUR LIST
        </div>
        <div className="mt-1 text-[15px] text-[color:var(--color-fg)] leading-snug">
          {copy?.label || "Filing activity"}
        </div>
        <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
          {whyLine(o, sig)}
        </div>
      </div>

      {copy && (
        <div className="mt-5">
          <div className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
            WHAT TO DO
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
            {copy.action}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.18em]">
        <span>{o.signals} signal{o.signals === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{o.filings} filing{o.filings === 1 ? "" : "s"}</span>
        {o.news_mentions > 0 && (
          <>
            <span>·</span>
            <span className="text-[color:var(--color-warn)]">{o.news_mentions} news</span>
          </>
        )}
        {sig?.url && (
          <a
            href={sig.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto px-3 py-1.5 border border-[color:var(--color-line-strong)] text-[color:var(--color-fg)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Open SEC filing &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

function CompactCard({ o, sig }: { o: Originator; sig?: SecSignal }) {
  const copy = sig ? plainSignal(sig.signal_type) : null;
  return (
    <a
      href={sig?.url || "#"}
      target={sig?.url ? "_blank" : undefined}
      rel="noreferrer"
      className="block bg-[color:var(--color-bg-1)] p-5 hover:bg-[color:var(--color-bg-2)] transition"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xl text-[color:var(--color-accent)]">{o.ticker}</span>
        <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.18em]">
          conf&nbsp;{o.max_confidence.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">{o.name}</div>
      <div className="mt-3 text-[12px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2">
        {copy?.label || "Filing activity"} — {whyLine(o, sig)}
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
      <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-10">
        <div className="font-mono text-[11px] tracking-[0.3em] text-[color:var(--color-warn)]">
          NO DATA YET
        </div>
        <h2 className="mt-3 text-2xl font-medium tracking-tight">Run the workers to populate your workbase.</h2>
        <pre className="mt-4 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] p-4 font-mono text-[12px] text-[color:var(--color-fg-dim)] overflow-x-auto">
{`make workers
# or
source workers/.venv/bin/activate
python -m workers.run`}
        </pre>
        <p className="mt-4 text-[color:var(--color-fg-dim)]">
          The first run takes ~5 minutes. Reload this page when it's done.
        </p>
      </div>
    </section>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
      {label}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "ok" | "dim" | "default";
}) {
  const color =
    tone === "ok"
      ? "text-[color:var(--color-accent)]"
      : tone === "dim"
      ? "text-[color:var(--color-fg-faint)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-3xl tick ${color}`}>{value}</div>
      {hint && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
          {hint}
        </div>
      )}
    </div>
  );
}

function HowCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
        <span className="text-[color:var(--color-accent)]">{step}</span>
        <span className="h-px w-6 bg-[color:var(--color-line-strong)]" />
      </div>
      <div className="mt-3 text-[15px] font-medium text-[color:var(--color-fg)]">{title}</div>
      <div className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">{body}</div>
    </div>
  );
}

function NewsRow({ n }: { n: NewsSignal }) {
  return (
    <a
      href={n.link}
      target="_blank"
      rel="noreferrer"
      className="block px-5 py-3 hover:bg-[color:var(--color-bg-2)] transition"
    >
      <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
        {n.matched_tickers && n.matched_tickers.length > 0 && (
          <span className="text-[color:var(--color-accent)]">
            {n.matched_tickers.join(" · ")}
          </span>
        )}
        <span>{relativeAge(n.published_at)}</span>
        {n.publisher && <span className="ml-auto truncate max-w-[40%]">{n.publisher}</span>}
      </div>
      <div className="mt-1 text-[14px] text-[color:var(--color-fg)] truncate">{n.title}</div>
    </a>
  );
}

function CourtRow({ c }: { c: CourtSignal }) {
  return (
    <a
      href={c.absolute_url}
      target="_blank"
      rel="noreferrer"
      className="block px-5 py-3 hover:bg-[color:var(--color-bg-2)] transition"
    >
      <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
        <span className="text-[color:var(--color-warn)] uppercase">
          {c.query_label.replace(/_/g, " ")}
        </span>
        <span>{c.date_filed?.slice(0, 10) || "—"}</span>
        {c.court_short && <span>{c.court_short}</span>}
      </div>
      <div className="mt-1 text-[14px] text-[color:var(--color-fg)] truncate">{c.case_name}</div>
    </a>
  );
}

function SignalsTable({ signals }: { signals: SecSignal[] }) {
  const sorted = [...signals].sort((a, b) => b.confidence - a.confidence).slice(0, 25);
  return (
    <div className="bg-[color:var(--color-bg-1)]">
      <table className="w-full font-mono text-[12px]">
        <thead className="text-[color:var(--color-fg-faint)] tracking-[0.18em] text-[10px] uppercase">
          <tr className="border-b border-[color:var(--color-line)]">
            <th className="px-4 py-2.5 text-left font-normal">Ticker</th>
            <th className="px-4 py-2.5 text-left font-normal">What it means</th>
            <th className="px-4 py-2.5 text-right font-normal">Confidence</th>
            <th className="px-4 py-2.5 text-right font-normal">Filed</th>
            <th className="px-4 py-2.5 text-left font-normal">Open</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const copy = plainSignal(s.signal_type);
            const tone = confidenceLabel(s.confidence).tone;
            return (
              <tr
                key={s.source_id + s.ticker}
                className="border-b border-[color:var(--color-line)] last:border-b-0"
              >
                <td className="px-4 py-2.5 text-[color:var(--color-accent)]">{s.ticker}</td>
                <td className="px-4 py-2.5 text-[color:var(--color-fg)]">
                  {copy.label}
                  {s.source === "sec_xbrl" && typeof s.yoy_pct === "number" && (
                    <span
                      className={`ml-2 ${tone === "strong" ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-warn)]"}`}
                    >
                      {s.yoy_pct >= 0 ? "+" : ""}
                      {s.yoy_pct.toFixed(0)}% YoY
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tick">
                  <span className={tone === "strong" ? "text-[color:var(--color-accent)]" : tone === "watch" ? "text-[color:var(--color-warn)]" : "text-[color:var(--color-fg-faint)]"}>
                    {s.confidence.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-[color:var(--color-fg-dim)]">
                  {relativeAge(s.filed_at)}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--color-fg)] hover:text-[color:var(--color-accent)]"
                  >
                    SEC &rarr;
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilingsTable({ filings }: { filings: RadarSnapshot["recent_filings"] }) {
  return (
    <div className="bg-[color:var(--color-bg-1)]">
      <table className="w-full font-mono text-[11px]">
        <thead className="text-[color:var(--color-fg-faint)] tracking-[0.18em] text-[10px] uppercase">
          <tr className="border-b border-[color:var(--color-line)]">
            <th className="px-4 py-2.5 text-left font-normal">Filed</th>
            <th className="px-4 py-2.5 text-left font-normal">Ticker</th>
            <th className="px-4 py-2.5 text-left font-normal">Form</th>
            <th className="px-4 py-2.5 text-left font-normal">Description</th>
          </tr>
        </thead>
        <tbody>
          {filings.map((f) => (
            <tr
              key={f.source_id + f.ticker}
              className="border-b border-[color:var(--color-line)] last:border-b-0"
            >
              <td className="px-4 py-2.5 text-[color:var(--color-fg-dim)]">{f.filed_at?.slice(0, 10)}</td>
              <td className="px-4 py-2.5 text-[color:var(--color-accent)]">{f.ticker}</td>
              <td className="px-4 py-2.5">{f.form_type}</td>
              <td className="px-4 py-2.5">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-fg)] hover:text-[color:var(--color-accent)]"
                >
                  {f.description || "open"}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] [&[open]>summary]:border-b group">
      <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between font-mono text-[12px] tracking-[0.18em] text-[color:var(--color-fg)] uppercase border-b border-transparent hover:bg-[color:var(--color-bg-2)] transition">
        <span>{summary}</span>
        <span className="text-[color:var(--color-fg-faint)] group-open:rotate-90 inline-block transition-transform">
          &rarr;
        </span>
      </summary>
      <div className="border-[color:var(--color-line)]">{children}</div>
    </details>
  );
}
