import Link from "next/link";
import { NearMeChip } from "./_near-me-chip";
import {
  enrichSignal,
  fitTier,
  fitTierLabel,
  formatUsdShort,
  humanAssetClass,
  isPersistent,
  signalFitScore,
  stateRiskLevel,
} from "@/lib/signal-enrichment";
import type { FdicSignal, NcuaSignal } from "@/lib/snapshot";

// Mid-Atlantic target cluster (see 00_PROJECT_SNAPSHOT.md — operating state is
// VA / MD / NC / GA). The "My region" chip lets a buyer pull every local seller
// across the home cluster in one click.
const HOME_REGION = ["VA", "MD", "NC", "GA"] as const;
const HOME_REGION_SET = new Set<string>(HOME_REGION);

// Max cards rendered after filtering — keeps the DOM sane even though the
// snapshot now carries up to 300 signals per stream for local coverage.
const RENDER_CAP = 60;

function locHref(loc: string): string {
  return loc === "all" ? "/app/banks" : `/app/banks?loc=${encodeURIComponent(loc)}`;
}

/** Display location: "Roanoke, VA" when city is known, else just the state. */
function placeLabel(s: FdicSignal | NcuaSignal): string {
  return s.city ? `${s.city}, ${s.state}` : s.state;
}

const SIGNAL_LABEL: Record<string, string> = {
  npl_ratio_increase: "Noncurrent loans rising",
  charge_off_increase: "Net charge-offs accelerating",
};

function signalLabel(type: string): string {
  return SIGNAL_LABEL[type] || "Credit-quality signal";
}

const TIER_BADGE: Record<string, string> = {
  community: "Community bank",
  regional: "Regional bank",
  "credit-union": "Credit union",
};

function tierBadge(tier: string): string {
  return TIER_BADGE[tier] || "Community bank";
}

function formatAssets(thousands: number): string {
  const dollars = thousands * 1000;
  if (dollars >= 1_000_000_000)
    return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  return `$${Math.round(dollars / 1_000_000)}M`;
}

/** Collapse multiple signals per institution to one card — strongest wins.
 * Dedupes on `ticker` ("FDIC-{cert}" / "NCUA-{charter}") so a bank and a
 * credit union sharing a numeric id never collide. Tie-breaker: prefer
 * charge-off signals (they carry the per-class breakdown and are directly
 * sellable). */
function strongestPerInstitution(
  signals: (FdicSignal | NcuaSignal)[]
): (FdicSignal | NcuaSignal)[] {
  const byKey = new Map<string, FdicSignal | NcuaSignal>();
  for (const s of signals) {
    const existing = byKey.get(s.ticker);
    if (!existing) {
      byKey.set(s.ticker, s);
      continue;
    }
    if (s.confidence > existing.confidence) {
      byKey.set(s.ticker, s);
      continue;
    }
    // Tie on confidence — prefer the charge-off signal (richer payload).
    if (
      s.confidence === existing.confidence &&
      s.signal_type === "charge_off_increase" &&
      existing.signal_type !== "charge_off_increase"
    ) {
      byKey.set(s.ticker, s);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => signalFitScore(b) - signalFitScore(a)
  );
}

export function CommunityBanksSection({
  fdicSignals,
  ncuaSignals,
  locFilter,
}: {
  fdicSignals: FdicSignal[];
  ncuaSignals: NcuaSignal[];
  /** Location filter from the `?loc=` query param: "all", "region"
   * (the VA·MD·NC·GA cluster), or a 2-letter state code. */
  locFilter?: string;
}) {
  const allBanks = strongestPerInstitution([...fdicSignals, ...ncuaSignals]);

  // Normalize the requested location.
  const raw = (locFilter || "all").trim();
  const loc = raw.toLowerCase() === "region" ? "region" : raw.toUpperCase();

  // State inventory for the filter chips (from the full deduped set, before
  // the location filter is applied — so counts stay stable as you click).
  const stateCounts = new Map<string, number>();
  for (const b of allBanks) {
    const st = (b.state || "").toUpperCase();
    if (st) stateCounts.set(st, (stateCounts.get(st) || 0) + 1);
  }
  const statesSorted = Array.from(stateCounts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const regionCount = allBanks.filter((b) =>
    HOME_REGION_SET.has((b.state || "").toUpperCase())
  ).length;

  // Apply the location filter.
  let filtered = allBanks;
  if (loc === "region") {
    filtered = allBanks.filter((b) =>
      HOME_REGION_SET.has((b.state || "").toUpperCase())
    );
  } else if (loc && loc !== "ALL") {
    filtered = allBanks.filter((b) => (b.state || "").toUpperCase() === loc);
  }
  const matchCount = filtered.length;
  const banks = filtered.slice(0, RENDER_CAP);

  const isActive = (v: string) =>
    (v === "all" && (loc === "ALL" || loc === "" || !loc)) ||
    (v === "region" && loc === "region") ||
    v.toUpperCase() === loc;

  const chip = (key: string, label: string, count: number) => (
    <Link
      key={key}
      href={locHref(key)}
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full border transition ${
        isActive(key)
          ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
          : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
      }`}
    >
      {label}
      <span className="text-[color:var(--color-fg-faint)]">· {count}</span>
    </Link>
  );

  return (
    <section className="mt-14">
      <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        Community banks &amp; credit unions · FDIC + NCUA Call Reports
      </div>
      <h2 className="mt-2 font-serif text-3xl md:text-4xl tracking-tight text-[color:var(--color-fg)]">
        The institutions that&rsquo;ll actually sell you a first tape.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
        SEC filings only cover publicly-traded banks — the big ones that sell to
        panel buyers only. These are smaller FDIC-insured banks and NCUA credit
        unions (public and private) flagged by their quarterly Call Reports for
        rising charge-offs. Lower competition, smaller tapes, more likely to
        sell direct to a new buyer.
      </p>

      {/* Local filter — find sellers in your own backyard. There's a debt-
          shedding community bank or credit union in every state; this lets a
          buyer call the local ones, not just whoever ranks highest nationally. */}
      {allBanks.length > 0 && (
        <div className="mt-5">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
            Filter by location
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <NearMeChip
              activeLoc={loc}
              countsByState={Object.fromEntries(stateCounts)}
            />
            {chip("all", "All states", allBanks.length)}
            {regionCount > 0 && chip("region", "My region · VA·MD·NC·GA", regionCount)}
            {statesSorted.map(([st, n]) => chip(st, st, n))}
          </div>
          {loc !== "ALL" && loc !== "" && (
            <p className="mt-3 text-[12px] text-[color:var(--color-fg-dim)]">
              {matchCount === 0
                ? "No flagged sellers here this quarter — try an adjacent state or check back after the next Call Report."
                : `${matchCount} local seller${matchCount === 1 ? "" : "s"} ${
                    loc === "region" ? "across your region" : `in ${loc}`
                  }${matchCount > RENDER_CAP ? ` · showing top ${RENDER_CAP}` : ""}.`}
            </p>
          )}
        </div>
      )}

      {banks.length === 0 ? (
        // Only show the "scan pending" box when there's genuinely no data.
        // A location filter that matches nothing is explained by the chip
        // message above, so we render nothing extra here in that case.
        allBanks.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-6 py-8 text-center">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              Call Report scan pending
            </div>
            <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] max-w-md mx-auto leading-relaxed">
              The FDIC and NCUA Call Report workers run on the 6-hour cron.
              Community-bank and credit-union signals appear here after their
              first pass — Call Report data is quarterly, so this list refreshes
              when a new quarter publishes.
            </p>
          </div>
        ) : null
      ) : (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((s) => {
            const enriched = enrichSignal(s);
            const fit = signalFitScore(s);
            const tier = fitTier(fit);
            const risk = stateRiskLevel(s.state);
            return (
            <a
              key={s.cert}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="block p-5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] hover:bg-[color:var(--color-bg-2)] hover:border-[color:var(--color-line-strong)] transition"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] border border-[color:var(--color-accent-dim)]">
                  {tierBadge(s.tier)}
                </span>
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  {placeLabel(s)} · {formatAssets(s.asset_total)}
                </span>
              </div>
              <div className="mt-2 text-[15px] text-[color:var(--color-fg)] leading-snug">
                {s.originator_name}
              </div>
              <div className="mt-3 text-[13px] text-[color:var(--color-fg)] leading-snug">
                {signalLabel(s.signal_type)}
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
                {s.yoy_pct > 0 ? "+" : ""}
                {s.yoy_pct.toFixed(0)}% YoY · {s.period_label}
              </div>
              {enriched.dominantAssetClass && enriched.dominantAssetShare && (
                <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
                  Mostly{" "}
                  <span className="text-[color:var(--color-fg)]">
                    {humanAssetClass(enriched.dominantAssetClass)}
                  </span>{" "}
                  ({Math.round(enriched.dominantAssetShare * 100)}%)
                </div>
              )}
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center font-mono text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded border ${
                    tier === "strong"
                      ? "border-[color:var(--color-success)] text-[color:var(--color-success)]"
                      : tier === "worth_a_look"
                        ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                        : "border-[color:var(--color-line-strong)] text-[color:var(--color-fg-faint)]"
                  }`}
                  title={`Composite buyer-fit score: ${fit}/99`}
                >
                  {fitTierLabel(tier)} · {fit}
                </span>
                {enriched.estimatedAnnualSellableFaceUsd && (
                  <span className="inline-flex items-center font-mono text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-warn)] text-[color:var(--color-warn)]">
                    Est. ~{formatUsdShort(enriched.estimatedAnnualSellableFaceUsd)}/yr
                  </span>
                )}
                {risk === "tough" && (
                  <span
                    className="inline-flex items-center font-mono text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-danger)] text-[color:var(--color-danger)]"
                    title={`${s.state} consumer-protection laws compress recovery`}
                  >
                    Tough state
                  </span>
                )}
                {risk === "friendly" && (
                  <span
                    className="inline-flex items-center font-mono text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-success-dim)] text-[color:var(--color-success)]"
                    title={`${s.state} is operator-friendly for recovery`}
                  >
                    Friendly state
                  </span>
                )}
                {isPersistent(s) && (
                  <span
                    className="inline-flex items-center font-mono text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                    title={`Flagged in ${s.appearances} distinct quarters — persistent supply signal`}
                  >
                    Persistent · {s.appearances}q
                  </span>
                )}
              </div>
              {enriched.suggestedBrokers.length > 0 && (
                <div className="mt-2 text-[11px] text-[color:var(--color-fg-faint)] leading-snug">
                  Best-fit brokers:{" "}
                  <span className="text-[color:var(--color-fg-dim)]">
                    {enriched.suggestedBrokers.map((b) => b.shortName).join(", ")}
                  </span>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                <span>
                  {s.tier === "credit-union" ? "Charter" : "Cert"} #{s.cert}
                </span>
                <span className="ml-auto text-[color:var(--color-accent)]">
                  {s.tier === "credit-union" ? "NCUA profile" : "FDIC BankFind"}{" "}
                  ↗
                </span>
              </div>
            </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
