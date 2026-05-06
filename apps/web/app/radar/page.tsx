import Link from "next/link";
import {
  EMPTY_SNAPSHOT,
  type Filing,
  type NewsSignal,
  type Originator,
  type RadarSnapshot,
  type SecSignal,
  readSnapshot,
} from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SIGNAL_LABELS: Record<string, string> = {
  portfolio_sale_announced: "PORTFOLIO SALE",
  divestiture_announced: "DIVESTITURE",
  reserve_build: "RESERVE BUILD",
  charge_off_increase: "CHARGE-OFF +",
  npl_ratio_increase: "NPL RATIO +",
  guidance_change: "GUIDANCE",
  unspecified: "REVIEW WINDOW",
};

function confColor(conf: number): string {
  if (conf >= 0.7) return "text-[color:var(--color-accent)]";
  if (conf >= 0.45) return "text-[color:var(--color-warn)]";
  return "text-[color:var(--color-fg-faint)]";
}

function relativeAge(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso.slice(0, 10);
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export default async function RadarPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {
    snap = EMPTY_SNAPSHOT;
  }

  const isEmpty = snap.summary.filings_total === 0 && snap.summary.news_signals_total === 0;

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-7xl px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <div className="h-2 w-2 rounded-full bg-[color:var(--color-accent)] glow" />
            <span className="font-mono text-sm tracking-[0.2em]">TRADELINE</span>
          </Link>
          <span className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-fg-faint)] border border-[color:var(--color-line)] px-2 py-0.5">
            DEAL&nbsp;RADAR
          </span>
        </div>
        <div className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-fg-faint)]">
          {snap.generated_at
            ? `LAST RUN · ${snap.generated_at.replace("T", " ").slice(0, 19)} UTC`
            : "NEVER RUN"}
        </div>
      </header>

      {/* summary strip */}
      <section className="relative z-10 border-y border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 divide-x divide-[color:var(--color-line)]">
          <SummaryStat k="FILINGS" v={snap.summary.filings_total} />
          <SummaryStat
            k="SEC SIGNALS"
            v={snap.summary.sec_signals_total}
            tone={snap.summary.sec_signals_total > 0 ? "ok" : "dim"}
          />
          <SummaryStat
            k="NEWS HITS"
            v={snap.summary.news_signals_total}
            tone={snap.summary.news_signals_total > 0 ? "ok" : "dim"}
          />
          <SummaryStat k="ORIGINATORS" v={snap.summary.originators_with_filings} />
        </div>
      </section>

      {isEmpty && (
        <section className="relative z-10 mx-auto max-w-7xl px-6 py-24">
          <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-10">
            <div className="font-mono text-[11px] tracking-[0.3em] text-[color:var(--color-warn)]">
              NO DATA YET
            </div>
            <h2 className="mt-3 text-2xl font-medium tracking-tight">Run the workers.</h2>
            <pre className="mt-4 bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] p-4 font-mono text-[11px] text-[color:var(--color-fg-dim)] overflow-x-auto">
{`source workers/.venv/bin/activate
python -m workers.run`}
            </pre>
            <p className="mt-4 text-[color:var(--color-fg-dim)]">
              Reload this page after the run completes.
            </p>
          </div>
        </section>
      )}

      {/* originators */}
      {!isEmpty && snap.originators.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-6">
          <SectionHeader tag="01" label="ORIGINATORS · ranked by signal" />
          <div className="mt-4 border border-[color:var(--color-line)]">
            <table className="w-full font-mono text-[12px] tick">
              <thead className="text-[color:var(--color-fg-faint)] tracking-[0.18em] text-[10px]">
                <tr className="border-b border-[color:var(--color-line)]">
                  <Th>TICKER</Th>
                  <Th>NAME</Th>
                  <Th>TIER</Th>
                  <Th right>FILINGS</Th>
                  <Th right>SIGNALS</Th>
                  <Th right>NEWS</Th>
                  <Th right>MAX CONF</Th>
                  <Th right>LAST</Th>
                </tr>
              </thead>
              <tbody>
                {snap.originators.slice(0, 20).map((o: Originator) => (
                  <tr
                    key={o.ticker}
                    className="border-b border-[color:var(--color-line)] last:border-b-0 hover:bg-[color:var(--color-bg-1)] transition"
                  >
                    <Td className="text-[color:var(--color-accent)]">{o.ticker}</Td>
                    <Td className="text-[color:var(--color-fg)]">{o.name || "—"}</Td>
                    <Td className="text-[color:var(--color-fg-dim)]">{o.tier || "—"}</Td>
                    <Td right>{o.filings}</Td>
                    <Td right>{o.signals}</Td>
                    <Td right className={o.news_mentions > 0 ? "text-[color:var(--color-warn)]" : "text-[color:var(--color-fg-faint)]"}>
                      {o.news_mentions || "·"}
                    </Td>
                    <Td right className={confColor(o.max_confidence)}>
                      {o.max_confidence.toFixed(2)}
                    </Td>
                    <Td right className="text-[color:var(--color-fg-dim)]">
                      {relativeAge(o.last_filed_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* top signals */}
      {!isEmpty && snap.top_signals.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-6">
          <SectionHeader tag="02" label="SEC SIGNALS · highest confidence first" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
            {[...snap.top_signals]
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 12)
              .map((s: SecSignal) => (
                <a
                  key={s.source_id + s.ticker}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[color:var(--color-bg-1)] p-5 hover:bg-[color:var(--color-bg-2)] transition group"
                >
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em]">
                    <span className={confColor(s.confidence)}>
                      {SIGNAL_LABELS[s.signal_type] || s.signal_type.toUpperCase()}
                    </span>
                    <span className="text-[color:var(--color-fg-faint)]">
                      conf&nbsp;{s.confidence.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-mono text-lg text-[color:var(--color-accent)]">
                      {s.ticker}
                    </span>
                    <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
                      {s.form_type}
                      {s.source === "sec_xbrl" && s.period_label
                        ? ` · ${s.period_label}`
                        : s.items?.length
                        ? ` · items ${s.items.join(", ")}`
                        : ""}
                    </span>
                    <span className="font-mono text-[11px] text-[color:var(--color-fg-dim)] ml-auto">
                      {relativeAge(s.filed_at)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--color-fg)] truncate">
                    {s.originator_name}
                  </div>
                  {s.source === "sec_xbrl" && typeof s.yoy_pct === "number" && (
                    <div className="mt-2 font-mono text-[12px]">
                      <span className="text-[color:var(--color-fg-faint)]">YoY&nbsp;</span>
                      <span
                        className={
                          s.yoy_pct >= 100
                            ? "text-[color:var(--color-danger)]"
                            : "text-[color:var(--color-warn)]"
                        }
                      >
                        {s.yoy_pct >= 0 ? "+" : ""}
                        {s.yoy_pct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {s.excerpt && s.source !== "sec_xbrl" && (
                    <div className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] line-clamp-2">
                      {s.excerpt}
                    </div>
                  )}
                  {s.rationale && (
                    <div className="mt-3 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em] border-t border-[color:var(--color-line)] pt-2">
                      {s.rationale}
                    </div>
                  )}
                </a>
              ))}
          </div>
        </section>
      )}

      {/* matched news (joined to seed banks) */}
      {!isEmpty && snap.matched_news.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-6">
          <SectionHeader
            tag="03"
            label={`NEWS · joined to seed banks (${snap.summary.news_signals_matched} matches of ${snap.summary.news_signals_total})`}
          />
          <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {snap.matched_news.slice(0, 12).map((n: NewsSignal) => (
              <a
                key={n.source_id}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                className="block px-5 py-3 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                  <span className="text-[color:var(--color-accent)] tracking-[0.15em]">
                    {(n.matched_tickers || []).join(" · ")}
                  </span>
                  <span className="text-[color:var(--color-warn)] uppercase">
                    {n.query_label.replace(/_/g, " ")}
                  </span>
                  <span>{relativeAge(n.published_at)}</span>
                  {n.publisher && <span className="ml-auto truncate max-w-[35%]">{n.publisher}</span>}
                </div>
                <div className="mt-1 text-[14px] text-[color:var(--color-fg)] truncate">
                  {n.title}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* unmatched news (raw firehose) */}
      {!isEmpty && snap.top_news.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-6">
          <SectionHeader
            tag="03b"
            label="NEWS · raw firehose (any source, dedup off)"
          />
          <div className="mt-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
            {snap.top_news
              .filter((n) => !(n.matched_tickers && n.matched_tickers.length))
              .slice(0, 8)
              .map((n: NewsSignal) => (
                <a
                  key={n.source_id}
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block px-5 py-3 hover:bg-[color:var(--color-bg-2)] transition"
                >
                  <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
                    <span className="text-[color:var(--color-warn)] uppercase">
                      {n.query_label.replace(/_/g, " ")}
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

      {/* recent filings */}
      {!isEmpty && snap.recent_filings.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-20">
          <SectionHeader tag="04" label="RAW FILINGS · latest 30" />
          <div className="mt-4 border border-[color:var(--color-line)]">
            <table className="w-full font-mono text-[11px] tick">
              <thead className="text-[color:var(--color-fg-faint)] tracking-[0.18em] text-[10px]">
                <tr className="border-b border-[color:var(--color-line)]">
                  <Th>FILED</Th>
                  <Th>TICKER</Th>
                  <Th>FORM</Th>
                  <Th>ITEMS</Th>
                  <Th>DESCRIPTION</Th>
                </tr>
              </thead>
              <tbody>
                {snap.recent_filings.slice(0, 30).map((f: Filing) => (
                  <tr
                    key={f.source_id + f.ticker}
                    className="border-b border-[color:var(--color-line)] last:border-b-0 hover:bg-[color:var(--color-bg-1)] transition"
                  >
                    <Td className="text-[color:var(--color-fg-dim)]">{f.filed_at?.slice(0, 10)}</Td>
                    <Td className="text-[color:var(--color-accent)]">{f.ticker}</Td>
                    <Td>{f.form_type}</Td>
                    <Td className="text-[color:var(--color-fg-dim)]">
                      {f.items?.length ? f.items.join(", ") : "—"}
                    </Td>
                    <Td>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[color:var(--color-fg)] hover:text-[color:var(--color-accent)]"
                      >
                        {f.description || "open"}
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="relative z-10 border-t border-[color:var(--color-line)]">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.18em]">
          <div>© 2026 TRADELINE · DEAL RADAR · PUBLIC SOURCES ONLY</div>
          <div className="max-w-2xl text-right md:text-left">
            All data sourced from data.sec.gov and public news RSS. Zero consumer-level data.
            Confidence scores are first-pass heuristics — verify before acting.
          </div>
        </div>
      </footer>
    </main>
  );
}

function SummaryStat({
  k,
  v,
  tone = "default",
}: {
  k: string;
  v: number | string;
  tone?: "ok" | "dim" | "default";
}) {
  const color =
    tone === "ok"
      ? "text-[color:var(--color-accent)]"
      : tone === "dim"
      ? "text-[color:var(--color-fg-faint)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="px-6 py-4">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
        {k}
      </div>
      <div className={`mt-1 font-mono text-2xl tick ${color}`}>{v}</div>
    </div>
  );
}

function SectionHeader({ tag, label }: { tag: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)]">
      <span className="text-[color:var(--color-accent)]">{tag}</span>
      <span className="h-px w-8 bg-[color:var(--color-line-strong)]" />
      <span>{label}</span>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 ${right ? "text-right" : "text-left"} font-normal`}>{children}</th>
  );
}

function Td({
  children,
  right,
  className = "",
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-4 py-2.5 ${right ? "text-right" : "text-left"} ${className}`}>{children}</td>
  );
}
