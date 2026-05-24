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
}: {
  fdicSignals: FdicSignal[];
  ncuaSignals: NcuaSignal[];
}) {
  const banks = strongestPerInstitution([...fdicSignals, ...ncuaSignals]);

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

      {banks.length === 0 ? (
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
                  {s.state} · {formatAssets(s.asset_total)}
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
