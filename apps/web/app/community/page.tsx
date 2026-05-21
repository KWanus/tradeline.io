import Link from "next/link";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { plainSignal } from "@/lib/signal-copy";
import { PublicFooter } from "@/app/_components/public-footer";
import { jsonLdScript } from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 60;
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io"
).replace(/\/$/, "");

export const metadata = {
  title: "Community banks · the banks that sell first tapes · Tradeline",
  description:
    "Community banks showing rising charge-offs and noncurrent loans in their FDIC Call Reports — the small banks that realistically sell a first tape to a new debt buyer. Updated every 6 hours.",
  openGraph: {
    title: "Tradeline · community banks showing credit stress",
    description:
      "FDIC Call Report signals on small community banks — the realistic first-tape sellers.",
    type: "website" as const,
  },
};

function fmtUSDThousands(thousands: number): string {
  // FDIC reports dollar figures in thousands.
  const dollars = thousands * 1000;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}k`;
  return `$${Math.round(dollars)}`;
}

export default async function CommunityBanksPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; type?: string }>;
}) {
  const params = await searchParams;
  const activeState = (params.state || "").trim().toUpperCase();
  const activeType = (params.type || "").trim();

  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const all = snap.fdic_signals || [];

  // Counts built from the full set so the chip nav stays stable when filtered.
  const stateCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const s of all) {
    if (s.state) stateCounts.set(s.state, (stateCounts.get(s.state) || 0) + 1);
    if (s.signal_type)
      typeCounts.set(s.signal_type, (typeCounts.get(s.signal_type) || 0) + 1);
  }
  const topStates = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]);
  const typeList = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);

  let filtered = all
    .slice()
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (b.yoy_pct || 0) - (a.yoy_pct || 0);
    });
  if (activeState) filtered = filtered.filter((s) => s.state === activeState);
  if (activeType) filtered = filtered.filter((s) => s.signal_type === activeType);
  const visible = filtered.slice(0, DEFAULT_LIMIT);

  // Build a chip URL preserving the OTHER active filter.
  const stateUrl = (st?: string) => {
    const q = new URLSearchParams();
    if (st) q.set("state", st);
    if (activeType) q.set("type", activeType);
    const qs = q.toString();
    return `/community${qs ? `?${qs}` : ""}`;
  };
  const typeUrl = (ty?: string) => {
    const q = new URLSearchParams();
    if (activeState) q.set("state", activeState);
    if (ty) q.set("type", ty);
    const qs = q.toString();
    return `/community${qs ? `?${qs}` : ""}`;
  };

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Tradeline · community banks showing credit stress",
    description:
      "Community banks with rising charge-offs / noncurrent loans in their FDIC Call Reports — the realistic first-tape sellers.",
    url: `${SITE}/community`,
    publisher: { "@type": "Organization", name: "Tradeline", url: SITE },
    isPartOf: { "@type": "WebSite", name: "Tradeline", url: SITE },
    numberOfItems: filtered.length,
  };

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(ld)}
      />
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-4xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px]">Tradeline</span>
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
          Community banks
          {(activeState || activeType) && (
            <>
              {" · "}
              <span className="text-[color:var(--color-accent)]">
                {[activeState, activeType && plainSignal(activeType).label]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </>
          )}
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          The banks that sell{" "}
          <span className="italic text-gradient-accent">first tapes.</span>
        </h1>
        <p className="mt-5 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          The SEC radar covers publicly-traded banks. But a new debt buyer&rsquo;s
          first tape almost never comes from a public bank — it comes from a{" "}
          <strong className="text-[color:var(--color-fg)]">community bank</strong>{" "}
          small enough to sell a clean $1–5M pool. Those banks don&rsquo;t file
          with the SEC; they file quarterly Call Reports with the FDIC. This
          page scores {all.length} of them on rising charge-offs and noncurrent
          loans — updated every 6 hours.
          {(activeState || activeType) && (
            <>
              {" "}
              <Link
                href="/community"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                Clear filters
              </Link>
            </>
          )}
        </p>

        {/* Signal type chips */}
        {typeList.length > 0 && (
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
              Signal
            </div>
            <nav className="flex items-center gap-2 flex-wrap">
              <Link
                href={typeUrl()}
                className={chipClass(!activeType)}
              >
                All
              </Link>
              {typeList.map(([ty, count]) => (
                <Link key={ty} href={typeUrl(ty)} className={chipClass(activeType === ty)}>
                  {plainSignal(ty).label}{" "}
                  <span className="ml-1 text-[color:var(--color-fg-faint)]">
                    {count}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* State chips */}
        {topStates.length > 0 && (
          <div className="mt-4">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
              State
            </div>
            <nav className="flex items-center gap-2 flex-wrap">
              <Link href={stateUrl()} className={chipClass(!activeState)}>
                All
              </Link>
              {topStates.map(([st, count]) => (
                <Link key={st} href={stateUrl(st)} className={chipClass(activeState === st)}>
                  {st}{" "}
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
            {all.length === 0 ? (
              <>
                The FDIC Call Report worker hasn&rsquo;t populated this snapshot
                yet — it runs on the 6-hour radar cron. Check back shortly, or
                subscribe to{" "}
                <Link
                  href="/report"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  /report
                </Link>{" "}
                to get the weekly synthesis.
              </>
            ) : (
              <>
                No community banks match these filters.{" "}
                <Link
                  href="/community"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  Clear filters
                </Link>
                .
              </>
            )}
          </section>
        ) : (
          <section className="mt-8 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)] overflow-hidden">
            {visible.map((s) => {
              const copy = plainSignal(s.signal_type);
              const metric =
                s.signal_type === "charge_off_increase"
                  ? "net charge-offs"
                  : "noncurrent loans";
              return (
                <article
                  key={s.source_id}
                  className="px-5 py-4 hover:bg-[color:var(--color-bg-2)] transition"
                >
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[15px] font-medium text-[color:var(--color-fg)]">
                        {s.originator_name}
                      </span>
                      {s.state && (
                        <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]">
                          {s.state}
                        </span>
                      )}
                      <span className="font-mono text-[10px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
                        {fmtUSDThousands(s.asset_total)} assets · {s.period_label}
                      </span>
                    </div>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline shrink-0"
                    >
                      FDIC profile &nearr;
                    </a>
                  </div>
                  <div className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
                    {copy.label}
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
                  </div>
                  <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {metric}: {fmtUSDThousands(s.value)} (was{" "}
                    {fmtUSDThousands(s.prior_year_value)} a year earlier)
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
                    Call Report · confidence {s.confidence.toFixed(2)}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {filtered.length > visible.length && (
          <p className="mt-4 text-[12px] font-mono text-[color:var(--color-fg-faint)] text-center">
            Showing {visible.length} of {filtered.length}.
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-3 flex-wrap text-[11px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          <span>Take the data:</span>
          <a
            href={(() => {
              const q = new URLSearchParams();
              if (activeState) q.set("state", activeState);
              if (activeType) q.set("type", activeType);
              const qs = q.toString();
              return `/community.csv${qs ? `?${qs}` : ""}`;
            })()}
            className="text-[color:var(--color-accent)] hover:underline"
          >
            CSV &nearr;
          </a>
          <a
            href={(() => {
              const q = new URLSearchParams();
              if (activeState) q.set("state", activeState);
              if (activeType) q.set("type", activeType);
              const qs = q.toString();
              return `/api/community${qs ? `?${qs}` : ""}`;
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
            This is where your first tape comes from.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto leading-relaxed">
            A community bank with rising charge-offs is a bank with paper to
            sell. The Tradeline weekly report ranks these every Monday. Free.
            No paywall. No consumer data.
          </p>
          <div className="mt-5">
            <Link
              href="/report"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#1a0c00] hover:opacity-90 transition inline-block"
              style={{ background: "var(--gradient-primary)" }}
            >
              Subscribe &rarr;
            </Link>
          </div>
        </section>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          Snapshot generated {snap.generated_at?.slice(0, 16) || "—"} UTC.
          Source: FDIC BankFind Call Report financials. Aggregate,
          institution-level. No consumer or debtor data.
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}

function chipClass(active: boolean): string {
  return `font-mono text-[11px] tracking-[0.15em] uppercase px-3 py-1.5 rounded border transition ${
    active
      ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
      : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
  }`;
}
