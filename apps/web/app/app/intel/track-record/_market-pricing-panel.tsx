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
        The Tradeline Index · price of charged-off debt
      </div>
      <h2 className="mt-2 font-serif text-3xl tracking-tight text-[color:var(--color-fg)]">
        Charged-off paper is clearing at ~{mp.market_median_cents}¢ on the dollar.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-3xl leading-relaxed">
        The benchmark for what charged-off debt actually sells for — reconstructed
        from public debt buyers&rsquo; own SEC PCD filings (purchase price ÷ face
        value), the kind of price data the FTC once needed subpoenas to collect.
        {" "}{dir} Anchor your bids here; don&rsquo;t pay a seller above the
        market multiple for the asset class.
      </p>

      <IndexChart mp={mp} />

      <div className="mt-8 mb-2 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        By buyer &amp; segment
      </div>
      <div className="overflow-x-auto">
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
        The index is the quarterly median of the blended purchase multiple across
        every US public distressed-debt buyer that tags PCD purchases (auto-
        discovered via SEC&rsquo;s frames API; near-par loan acquisitions are
        excluded). Today that panel is {mp.panel_size ?? mp.buyers.length}{" "}
        {(mp.panel_size ?? mp.buyers.length) === 1 ? "buyer" : "buyers"}
        {mp.near_par_excluded ? ` (${mp.near_par_excluded} near-par filers excluded)` : ""}
        {" "}— Encore and PRA are the dominant public buyers, so it tracks the
        public market, but it is a benchmark, not a per-deal price. Segment
        sub-lines come from the raw filing instance. Vintage-level granularity
        isn&rsquo;t in public XBRL. Source: SEC XBRL. Updated{" "}
        {mp.generated_at.slice(0, 10)}.
      </p>
    </section>
  );
}

function IndexChart({ mp }: { mp: MarketPricing }) {
  const index = mp.index || [];
  if (index.length < 2) return null;
  const vals = index.map((p) => p.median_cents ?? 0);
  const max = Math.max(...vals, 1) * 1.15;

  function q(end: string): string {
    const m = end.slice(5, 7);
    const qq = m === "03" ? "Q1" : m === "06" ? "Q2" : m === "09" ? "Q3" : "Q4";
    return `${qq}'${end.slice(2, 4)}`;
  }

  return (
    <div className="mt-6 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Index · median ¢/$ · {mp.panel_size ?? mp.buyers.length} public buyers
        </span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          {q(index[0].end)} → {q(index[index.length - 1].end)}
        </span>
      </div>
      <div className="flex items-end gap-2 h-28">
        {index.map((p) => {
          const h = Math.max(6, Math.round(((p.median_cents ?? 0) / max) * 100));
          const isLast = p === index[index.length - 1];
          return (
            <div key={p.end} className="flex-1 flex flex-col items-center gap-1">
              <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)]">
                {p.median_cents}
              </span>
              <div
                className={`w-full rounded-t ${
                  isLast
                    ? "bg-[color:var(--color-accent)]"
                    : "bg-[color:var(--color-line-strong)]"
                }`}
                style={{ height: `${h}%` }}
                title={`${p.end}: ${p.median_cents}¢ (n=${p.n}, ${p.low}–${p.high}¢)`}
              />
              <span className="font-mono text-[9px] tracking-[0.1em] text-[color:var(--color-fg-faint)]">
                {q(p.end)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
