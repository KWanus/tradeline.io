import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { computePatternStats } from "@/lib/autopilot/pattern-performance";
import {
  plainSignal,
  relativeAge,
  STATUS_COPY,
  statusFor,
  topSignalFor,
  whyLine,
} from "@/lib/signal-copy";
import { ApprovalInbox } from "./_approval-inbox";
import { AutopilotPing } from "./_autopilot-ping";
import { PageHeader } from "../_components/page-header";
import { StatCard } from "../_components/stat-card";
import { WhatsNewRibbon } from "../_components/whats-new-ribbon";
import { buildProposals } from "./_proposals";
import { RoleGate } from "./_role-gate";
import { WatchlistSection } from "./_watchlist";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FRIENDLY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

type Originator = RadarSnapshot["originators"][number];
type Recommendation = {
  o: Originator;
  sig: ReturnType<typeof topSignalFor>;
  fit: number;
};

// Lightweight scoring blended from existing snapshot fields. Not a model —
// just a rank to surface the highest-signal banks above the inbox.
function fitScore(o: Originator, sig: ReturnType<typeof topSignalFor>): number {
  const status = statusFor(o);
  let score = status === "strong" ? 88 : status === "watching" ? 68 : 50;
  if (sig?.filed_at) {
    const ageDays =
      (Date.now() - new Date(sig.filed_at).getTime()) / 86_400_000;
    if (ageDays < 7) score += 6;
    else if (ageDays < 30) score += 2;
  }
  if (o.news_mentions > 0) {
    score += 3 + Math.min(o.news_mentions, 4);
  }
  return Math.min(99, Math.round(score));
}

// Mirror of fitScore's contributing factors — chips that explain *why* a
// bank scored what it did. Surfaced under the score so it reads as
// transparent instead of magical.
function reasonChips(
  o: Originator,
  sig: ReturnType<typeof topSignalFor>,
): string[] {
  const status = statusFor(o);
  const chips: string[] = [];
  if (status === "strong") chips.push("strong");
  else if (status === "watching") chips.push("watch");
  if (sig?.filed_at) {
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(sig.filed_at).getTime()) / 86_400_000),
    );
    if (days < 30) chips.push(`${days}d filed`);
  }
  if (o.news_mentions > 0) {
    chips.push(`news +${Math.min(o.news_mentions, 9)}`);
  }
  return chips.slice(0, 3);
}

export default async function TodayPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  // Outcome-based learning lift. Falls back to {} if the log is empty or
  // unreachable — buildProposals then ranks on static features only.
  let patternLifts;
  try {
    const stats = await computePatternStats();
    patternLifts = stats.lifts;
  } catch {}

  const strong = snap.originators.filter((o) => statusFor(o) === "strong");
  const primary = strong[0];
  const others = strong.slice(1, 4);
  const watching = snap.originators
    .filter((o) => statusFor(o) === "watching")
    .slice(0, 5);
  const recentNews = snap.matched_news.slice(0, 4);
  const proposals = buildProposals(snap, patternLifts);

  const recommendations: Recommendation[] = snap.originators
    .map((o) => {
      const sig = topSignalFor(o.ticker, snap.top_signals);
      return { o, sig, fit: fitScore(o, sig) };
    })
    .filter((r) => r.fit >= 65)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 3);

  const queueCount = proposals.length;
  const tagline =
    queueCount > 0
      ? `${queueCount} ${queueCount === 1 ? "action" : "actions"} queued. ${recommendations.length > 0 ? "Top picks below." : "Approve and ship."}`
      : recommendations.length > 0
        ? `No urgent queue. Worth a look: ${recommendations.length} ${recommendations.length === 1 ? "bank" : "banks"} below.`
        : "Quiet morning. The radar runs every 6 hours.";

  return (
    <main className="relative px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <div className="absolute inset-x-0 top-0 h-96 bg-aurora pointer-events-none" />
      <div className="relative">
        <AutopilotPing />

        <RoleGate>
        <PageHeader
          icon={<span aria-hidden>☀</span>}
          title="Today"
          badge={{ label: "Live", tone: "success" }}
          tagline={tagline}
          meta={
            <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)]">
              {FRIENDLY_DATE.format(new Date())}
            </span>
          }
        />

        <WhatsNewRibbon generatedAt={snap.generated_at} />

        <div className="stagger-fade grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <StatCard
            value={queueCount}
            label="Queued"
            tone={queueCount > 0 ? "accent" : "default"}
            delta={queueCount > 0 ? "ready to approve" : "all clear"}
          />
          <StatCard
            value={strong.length}
            label="Strong signal"
            tone="success"
            delta={strong.length > 0 ? "outreach now" : "nothing hot"}
            href="/app/banks?filter=strong"
          />
          <StatCard
            value={watching.length}
            label="Watching"
            tone="warn"
            delta={watching.length > 0 ? "next 1-2 quarters" : "—"}
            href="/app/banks?filter=watching"
          />
          <StatCard
            value={snap.originators.length}
            label="Banks tracked"
            delta="full radar"
            href="/app/banks"
          />
        </div>

        {recommendations.length > 0 && (
          <RecommendedBand items={recommendations} />
        )}

        <ApprovalInbox proposals={proposals} generatedAt={snap.generated_at} />

        {/* Below-the-fold radar context — collapsed by default. Browsing mode. */}
        <details className="group mt-10 mb-12 border-t border-[color:var(--color-line)] pt-8">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 select-none">
            <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] group-hover:text-[color:var(--color-accent)] transition">
              Show full radar · {strong.length} strong · {watching.length} watching · {recentNews.length} news
            </span>
            <span className="font-mono text-[12px] text-[color:var(--color-fg-faint)] group-open:rotate-180 inline-block transition-transform">
              ▾
            </span>
          </summary>
          {primary && (
            <div className="mt-8">
              <Hero
                o={primary}
                sig={topSignalFor(primary.ticker, snap.top_signals)}
              />
            </div>
          )}

          <WatchlistSection
            originators={snap.originators.map((o) => {
              const sig = topSignalFor(o.ticker, snap.top_signals);
              const status = statusFor(o);
              return {
                ticker: o.ticker,
                name: o.name,
                tier: o.tier,
                status,
                signal_label: sig ? plainSignal(sig.signal_type).label : undefined,
              };
            })}
          />

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
              <div className="card mt-4 divide-y divide-[color:var(--color-line)]">
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
              <div className="card mt-4 divide-y divide-[color:var(--color-line)]">
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
                      {n.publisher && (
                        <span className="ml-auto truncate max-w-[40%]">
                          {n.publisher}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[14px] text-[color:var(--color-fg)] truncate">
                      {n.title}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </details>

        <p className="mt-12 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed max-w-2xl">
          Public sources only. Zero consumer data. This radar tells you which
          banks may divest debt portfolios — actual purchase requires a state
          license, a bond, broker relationships, and wired funds. None of those
          happen in a browser.
        </p>
        </RoleGate>
      </div>
    </main>
  );
}

function RecommendedBand({ items }: { items: Recommendation[] }) {
  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-[color:var(--color-fg)]">
            Recommended for you
          </h2>
          <p className="text-[12px] text-[color:var(--color-fg-dim)] mt-0.5">
            Highest-fit banks right now — open one to read the room and draft outreach.
          </p>
        </div>
        <Link
          href="/app/banks"
          className="text-[11px] font-mono tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)] transition"
        >
          See all →
        </Link>
      </div>
      <div className="stagger-fade grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map(({ o, sig, fit }) => (
          <RecommendedCard key={o.ticker} o={o} sig={sig} fit={fit} />
        ))}
      </div>
    </section>
  );
}

function RecommendedCard({
  o,
  sig,
  fit,
}: {
  o: Originator;
  sig: ReturnType<typeof topSignalFor>;
  fit: number;
}) {
  const copy = sig ? plainSignal(sig.signal_type) : null;
  const status = statusFor(o);
  const reasons = reasonChips(o, sig);
  const fitTone =
    fit >= 90
      ? "text-[color:var(--color-success)]"
      : fit >= 80
        ? "text-[color:var(--color-accent)]"
        : "text-[color:var(--color-warn)]";

  return (
    <Link
      href={`/app/banks/${o.ticker}`}
      className="card lift-on-hover block p-5 relative"
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="font-mono text-[18px] text-[color:var(--color-accent)] tracking-tight leading-none">
            {o.ticker}
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">
            {o.name}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1">
          <div className={`font-mono text-[13px] font-semibold ${fitTone}`}>
            {fit}% fit
          </div>
          {reasons.length > 0 && (
            <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[color:var(--color-fg-faint)] text-right leading-tight">
              {reasons.join(" · ")}
            </div>
          )}
        </div>
      </div>

      <p className="text-[13px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2">
        {copy?.label || "Filing activity worth checking."}
      </p>

      <div className="mt-4 flex items-center gap-1.5 flex-wrap">
        {o.tier && <Chip label={o.tier} />}
        <Chip
          label={STATUS_COPY[status].label}
          tone={status === "strong" ? "primary" : "neutral"}
        />
        {sig?.filed_at && <Chip label={relativeAge(sig.filed_at)} />}
      </div>
    </Link>
  );
}

function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "primary" | "neutral";
}) {
  if (tone === "primary") {
    return (
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase px-2 py-0.5 rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] border border-[color:var(--color-line-strong)]">
        {label}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] tracking-[0.14em] uppercase px-2 py-0.5 rounded-full bg-[color:var(--color-bg-1)] text-[color:var(--color-fg-faint)] border border-[color:var(--color-line)]">
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-semibold text-[16px] text-[color:var(--color-fg-dim)] mb-1 tracking-tight">
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
        <span className={`badge ${STATUS_COPY[status].tone}`}>
          {STATUS_COPY[status].label}
        </span>
      </div>

      <div className="relative flex items-baseline gap-4 flex-wrap">
        <span className="font-mono text-5xl md:text-6xl text-[color:var(--color-accent)] tracking-tight">
          {o.ticker}
        </span>
        <span className="text-2xl md:text-3xl text-[color:var(--color-fg)] tracking-tight font-semibold">
          {o.name}
        </span>
      </div>

      <div className="relative mt-8 max-w-2xl">
        <div className="text-[26px] md:text-[30px] tracking-tight text-[color:var(--color-fg)] leading-tight font-semibold">
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
        <Link href={`/app/banks/${o.ticker}`} className="btn-primary">
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
        <span className="font-mono text-2xl text-[color:var(--color-accent)]">
          {ticker}
        </span>
        {newsMentions > 0 && (
          <span className="text-[11px] text-[color:var(--color-warn)]">
            {newsMentions} news
          </span>
        )}
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">
        {name}
      </div>
      <div className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2">
        {copy?.label || "Filing activity"}
      </div>
    </Link>
  );
}
