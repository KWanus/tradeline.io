import type { MarketPricing } from "@/lib/snapshot";

const TREND_ICON: Record<string, string> = { rising: "▲", falling: "▼", flat: "—" };

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

/** "Who bought, at what price" — from public debt buyers' SEC disclosures.
 * The market clearing multiple for charged-off paper, no partner feed needed. */
export function MarketPricingPanel({ mp }: { mp?: MarketPricing | null }) {
  if (!mp || mp.market_median_cents == null || mp.buyers.length === 0) return null;

  const dir =
    mp.price_direction === "rising"
      ? "Buyers are paying up — bid competitively or wait for supply."
      : mp.price_direction === "softening"
        ? "Pricing is softening — you can bid lower; supply looks ample."
        : "Pricing is mixed across buyers.";

  return (
    <section className="mt-14">
      <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        Market pricing · public buyer disclosures
      </div>
      <h2 className="mt-2 font-serif text-3xl tracking-tight text-[color:var(--color-fg)]">
        Charged-off paper is clearing at ~{mp.market_median_cents}¢ on the dollar.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-3xl leading-relaxed">
        The marketplaces gate the transaction record — but the big debt buyers
        are public, and they disclose what they pay. This is their blended
        purchase multiple (purchase price ÷ face value) from SEC PCD filings:
        the public answer to &ldquo;at what price.&rdquo; {dir} Anchor your own
        bids here — don&rsquo;t pay a seller above the market multiple for the
        asset class.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)]">
              <th className="py-2 pr-4">Buyer</th>
              <th className="py-2 pr-4">Cents / $</th>
              <th className="py-2 pr-4">YoY</th>
              <th className="py-2 pr-4">Face held</th>
              <th className="py-2 pr-4">As of</th>
            </tr>
          </thead>
          <tbody>
            {mp.buyers.map((b) => (
              <tr key={b.ticker} className="border-t border-[color:var(--color-line)]">
                <td className="py-2 pr-4 text-[color:var(--color-fg)]">
                  {b.name} <span className="text-[color:var(--color-fg-faint)]">({b.ticker})</span>
                  {b.segments && b.segments.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-[color:var(--color-fg-dim)]">
                      {b.segments.map((s, i) => (
                        <span key={s.segment}>
                          {i > 0 ? " · " : ""}
                          {s.segment}{" "}
                          <span className="font-mono text-[color:var(--color-fg)]">
                            {s.cents}¢
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-4 font-mono text-[color:var(--color-fg)]">
                  {b.latest_cents}¢
                </td>
                <td className="py-2 pr-4 font-mono whitespace-nowrap">
                  <span
                    className={
                      b.trend === "rising"
                        ? "text-[color:var(--color-warn)]"
                        : b.trend === "falling"
                          ? "text-[color:var(--color-success)]"
                          : "text-[color:var(--color-fg-faint)]"
                    }
                  >
                    {TREND_ICON[b.trend]}{" "}
                    {b.yoy_change == null ? "—" : `${b.yoy_change >= 0 ? "+" : ""}${b.yoy_change}`}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-[color:var(--color-fg-dim)]">
                  {fmtUsd(b.par_value)}
                </td>
                <td className="py-2 pr-4 text-[color:var(--color-fg-dim)]">{b.as_of}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-[color:var(--color-fg-faint)] max-w-3xl leading-relaxed">
        Blended multiple on each buyer&rsquo;s held PCD pool (not a single
        deal); sub-lines break it out by portfolio segment where the filer tags
        it (e.g. insolvency paper prices higher than core charge-off). Falling
        YoY means the market is paying less than a year ago. Source: SEC XBRL
        (companyfacts + the raw filing instance). Updated{" "}
        {mp.generated_at.slice(0, 10)}.
      </p>
    </section>
  );
}
