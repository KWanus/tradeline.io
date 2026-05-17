import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor } from "@/lib/signal-copy";
import { ReportSubscribeForm } from "./_subscribe-form";
import { PublicFooter } from "@/app/_components/public-footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "The 57-Bank Charge-Off Report · Tradeline weekly",
  description:
    "Every Monday: which US banks are showing distress in their public filings, scored. Free. No paywall. No consumer data. Filtered from SEC EDGAR, XBRL, and news every 6 hours.",
  openGraph: {
    title: "The 57-Bank Charge-Off Report",
    description:
      "Every Monday: which US banks are showing distress in their public filings, scored. Free. No paywall. No consumer data.",
    type: "website" as const,
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "The 57-Bank Charge-Off Report",
    description:
      "Every Monday: which US banks are showing distress in their public filings, scored. Free.",
  },
};

const FRIENDLY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function isoWeek(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default async function ReportLandingPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const week = isoWeek(new Date());
  const strong = snap.originators
    .filter((o) => statusFor(o) === "strong")
    .slice(0, 5);
  const watching = snap.originators
    .filter((o) => statusFor(o) === "watching")
    .slice(0, 5);
  const recentNews = snap.matched_news.slice(0, 3);
  const sortedSignals = [...snap.top_signals]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)] overflow-hidden">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      {/* nav */}
      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition group">
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px] shadow-[0_6px_18px_-6px_rgba(236,72,153,0.5)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px] text-[color:var(--color-fg)]">
            Tradeline
          </span>
        </Link>
        <Link
          href="/app/today"
          className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Open the workbase &rarr;
        </Link>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-12 pb-12">
        <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Tradeline weekly · {week}
        </div>
        <h1 className="mt-4 font-serif text-5xl md:text-7xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
          The {snap.originators.length || 57}-Bank{" "}
          <span className="italic text-gradient-accent">
            Charge-Off
          </span>{" "}
          Report.
        </h1>
        <p className="mt-6 text-[color:var(--color-fg-dim)] text-lg md:text-xl leading-relaxed max-w-3xl">
          Every week, Tradeline scans {snap.originators.length || 57} US banks, fintechs, and
          specialty lenders for credit-quality signals — accelerating charge-offs, rising
          non-performing loan ratios, reserve builds, divestiture announcements. We score them,
          rank them, and send you the names that matter <em>before</em> the broker memo lands.
        </p>
        <p className="mt-3 text-[15px] text-[color:var(--color-fg-faint)]">
          Free. No credit card. {FRIENDLY_DATE.format(new Date())} edition below.
        </p>

        {/* SUBSCRIBE FORM */}
        <div className="mt-10 max-w-xl">
          <ReportSubscribeForm />
        </div>
      </section>

      {/* THIS WEEK PREVIEW */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="card-elevated p-7 md:p-10">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            This week&rsquo;s edition · live preview
          </div>
          <h2 className="mt-3 font-serif text-3xl md:text-4xl tracking-tight">
            <span className="italic">{strong.length}</span> banks need attention.
          </h2>
          <p className="mt-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Subscribers get the full digest in their inbox every Monday. Here&rsquo;s
            this week&rsquo;s headline bank list.
          </p>

          {/* Strong list */}
          {strong.length > 0 && (
            <div className="mt-7">
              <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mb-3">
                Strong signals · 5 names
              </div>
              <ul className="space-y-2">
                {strong.map((o) => (
                  <li
                    key={o.ticker}
                    className="flex items-baseline gap-4 text-[14px]"
                  >
                    <span className="font-mono text-[16px] text-[color:var(--color-accent)] w-16 tick">
                      {o.ticker}
                    </span>
                    <span className="text-[color:var(--color-fg)] flex-1 truncate">
                      {o.name}
                    </span>
                    <span className="text-[color:var(--color-fg-faint)] text-[12px] hidden md:inline">
                      {o.tier}
                    </span>
                    <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)]">
                      conf {o.max_confidence.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Watching list */}
          {watching.length > 0 && (
            <div className="mt-7">
              <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-warn)] mb-3">
                Worth watching · {watching.length} names
              </div>
              <ul className="space-y-1.5">
                {watching.map((o) => (
                  <li
                    key={o.ticker}
                    className="flex items-baseline gap-4 text-[13px]"
                  >
                    <span className="font-mono text-[14px] text-[color:var(--color-accent)] w-16 tick">
                      {o.ticker}
                    </span>
                    <span className="text-[color:var(--color-fg-dim)] flex-1 truncate">
                      {o.name}
                    </span>
                    <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
                      conf {o.max_confidence.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top signals */}
          {sortedSignals.length > 0 && (
            <div className="mt-7">
              <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-3">
                Top signals this week
              </div>
              <ul className="space-y-2">
                {sortedSignals.slice(0, 5).map((s) => {
                  const copy = plainSignal(s.signal_type);
                  return (
                    <li key={s.source_id} className="text-[13px] leading-relaxed">
                      <span className="font-mono text-[color:var(--color-accent)]">
                        {s.ticker}
                      </span>{" "}
                      <span className="text-[color:var(--color-fg)]">
                        {copy.label}
                      </span>
                      {s.source === "sec_xbrl" &&
                        typeof s.yoy_pct === "number" && (
                          <span
                            className={`ml-2 font-mono text-[12px] ${
                              s.yoy_pct >= 100
                                ? "text-[color:var(--color-danger)]"
                                : "text-[color:var(--color-warn)]"
                            }`}
                          >
                            {s.yoy_pct >= 0 ? "+" : ""}
                            {s.yoy_pct.toFixed(0)}% YoY
                          </span>
                        )}
                      <span className="ml-2 text-[color:var(--color-fg-faint)] text-[12px]">
                        ({s.form_type})
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Recent matched news */}
          {recentNews.length > 0 && (
            <div className="mt-7">
              <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-3">
                In the news
              </div>
              <ul className="space-y-2">
                {recentNews.map((n) => (
                  <li key={n.source_id} className="text-[13px] leading-relaxed">
                    <span className="font-mono text-[color:var(--color-accent)]">
                      {(n.matched_tickers || []).join(" · ")}
                    </span>{" "}
                    <span className="text-[color:var(--color-fg)]">
                      {n.title}
                    </span>
                    {n.publisher && (
                      <span className="ml-2 text-[color:var(--color-fg-faint)] text-[11px]">
                        {n.publisher}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {strong.length === 0 && watching.length === 0 && (
            <p className="mt-6 text-[14px] text-[color:var(--color-fg-faint)]">
              Quiet week. All banks within normal credit-quality bands. The
              report will tell you that too — sometimes silence is the signal.
            </p>
          )}
        </div>

        <div className="mt-6 text-[12px] text-[color:var(--color-fg-faint)] text-center">
          Snapshot generated {snap.generated_at?.slice(0, 16) || "—"} UTC ·{" "}
          {snap.summary?.filings_total || 0} SEC filings indexed ·{" "}
          {snap.summary?.sec_signals_total || 0} signals scored
        </div>
      </section>

      {/* WHO READS IT */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Who reads the weekly
        </div>
        <h2 className="mt-3 font-serif text-3xl md:text-4xl tracking-tight">
          People who buy this paper for a living.
        </h2>
        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Reader
            who="Licensed debt buyers"
            why="See bank-level distress before it shows up on NLEX or EverChain. Time the ask, not the bid."
          />
          <Reader
            who="Brokers (NLEX, Garnet, RMG, Kondaur)"
            why="Pre-position your buyer panel for the names actually about to divest. Stop chasing reactions."
          />
          <Reader
            who="Hypothecation lenders"
            why="Match buyer-pipeline timing to portfolio maturity. Know who will be 12-month seasoned by Q3."
          />
          <Reader
            who="Consumer-finance attorneys + receivables CPAs"
            why="Know which buyers are growing past your service threshold. Pipeline before the cold call."
          />
        </div>
      </section>

      {/* WHAT'S INSIDE */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          What&rsquo;s in every issue
        </div>
        <h2 className="mt-3 font-serif text-3xl md:text-4xl tracking-tight">
          Same shape every Monday.
        </h2>
        <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Inside
            n="01"
            title="The watch list"
            body="3–5 banks with strong distress signals this week. Plain-English why and the asset class likely to be divested."
          />
          <Inside
            n="02"
            title="The signals"
            body="Per-bank breakdown of charge-off acceleration, NPL ratio, reserve build, and 8-K disposition events scored from public filings."
          />
          <Inside
            n="03"
            title="What changed"
            body="Diff against last week — new entrants on the watch list, names that quieted down, news that landed."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <div className="card-elevated p-8 md:p-12 text-center">
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
            Get it in your inbox every Monday.
          </h2>
          <p className="mt-3 text-[15px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto leading-relaxed">
            Free for everyone. No paywall. No credit card. Built so the next
            time you walk into a broker call, you already know what they&rsquo;re
            about to pitch.
          </p>
          <div className="mt-7 max-w-xl mx-auto">
            <ReportSubscribeForm />
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function Reader({ who, why }: { who: string; why: string }) {
  return (
    <article className="card p-5">
      <h3 className="font-serif italic text-[18px] text-[color:var(--color-fg)] tracking-tight">
        {who}
      </h3>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {why}
      </p>
    </article>
  );
}

function Inside({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <article className="card p-5">
      <div className="font-mono text-[24px] text-[color:var(--color-accent)] tick">
        {n}
      </div>
      <h3 className="mt-2 font-serif italic text-[18px] text-[color:var(--color-fg)] tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {body}
      </p>
    </article>
  );
}
