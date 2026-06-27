import type { TrackRecord } from "@/lib/snapshot";

const LEADING_LABEL: Record<string, string> = {
  charge_off_increase: "Charge-offs accelerating",
  npl_ratio_increase: "Noncurrent loans rising",
  reserve_build: "Reserve build (8-K 2.06)",
  guidance_change: "Guidance change",
};

const EVENT_LABEL: Record<string, string> = {
  portfolio_sale_announced: "Debt-portfolio sale",
  divestiture_announced: "Disposition (unconfirmed type)",
};

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function Stat({ value, label }: { value: string | number; label: string; }) {
  return (
    <div className="card p-5">
      <div className="font-mono text-3xl text-[color:var(--color-fg)]">{value}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">{label}</div>
    </div>
  );
}

export function BacktestPanel({ tr }: { tr?: TrackRecord }) {
  if (!tr || tr.events_total === 0) {
    return (
      <section className="card p-6">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-accent)]">
          Automated backtest · signal → disposition
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          No disclosed dispositions observed yet. As tracked banks file 8-K item
          2.01 (completed sale/disposition), this panel automatically checks
          whether a leading signal — charge-offs accelerating, noncurrent loans
          rising, reserve build — fired on that originator first, and reports the
          hit rate and how many days early. No manual logging required.
        </p>
      </section>
    );
  }

  const sorted = [...tr.events].sort((a, b) => {
    if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
    if (a.predicted !== b.predicted) return a.predicted ? -1 : 1;
    return b.event_date.localeCompare(a.event_date);
  });

  const hasConfirmed = tr.confirmed_total > 0;

  return (
    <section>
      <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-accent)]">
        Automated backtest · signal → disposition
      </div>
      <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-3xl">
        Computed from the full signal history — not hand-entered. For every
        disclosed disposition (8-K item 2.01), did a leading radar signal flag
        that originator first, within {tr.window_days} days?
      </p>

      {hasConfirmed ? (
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-5">
            <div className="font-mono text-3xl text-[color:var(--color-accent)]">
              {pct(tr.hit_rate)}
            </div>
            <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
              Confirmed sales flagged early
            </div>
          </div>
          <Stat value={`${tr.confirmed_predicted}/${tr.confirmed_total}`} label="Confirmed debt sales matched" />
          <Stat value={tr.median_lead_days ?? "—"} label="Median days early" />
          <Stat value={tr.avg_lead_days ?? "—"} label="Avg days early" />
        </div>
      ) : (
        // Honest state: instrumentation is live, but no *confirmed* debt-
        // portfolio sale has been disclosed via 8-K yet. Large public banks
        // sell charged-off paper privately, not in 8-Ks — so confirmed-sale
        // backtesting unlocks with marketplace-listing ingestion. We still
        // show the mechanism working against the generic dispositions we do see.
        <>
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat value={0} label="Confirmed debt sales (8-K)" />
            <Stat value={tr.candidate_total} label="Generic dispositions seen" />
            <Stat value={`${tr.events_predicted}/${tr.events_total}`} label="Flagged in advance" />
            <Stat value={tr.median_lead_days ?? "—"} label="Median days early" />
          </div>
          <div className="mt-4 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-bg-soft)] px-4 py-3 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            <strong className="text-[color:var(--color-fg)]">Instrumentation is live, headline not yet meaningful.</strong>{" "}
            The {tr.candidate_total} dispositions below are generic 8-K item-2.01
            filings (M&amp;A, branch or real-estate sales) from large public banks
            — not confirmed charged-off-debt sales, which those banks transact
            privately. The join works (it caught{" "}
            {tr.events_predicted} of them{tr.median_lead_days ? ` a median ${tr.median_lead_days} days early` : ""}),
            but a trustworthy hit rate needs <em>real</em> debt-sale events.
            Those come from marketplace-listing ingestion (EverChain / Debexpert
            / NLEX) — the next data source to wire.
          </div>
        </>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)]">
              <th className="py-2 pr-4">Originator</th>
              <th className="py-2 pr-4">Disposed</th>
              <th className="py-2 pr-4">Predicted?</th>
              <th className="py-2 pr-4">Leading signal</th>
              <th className="py-2 pr-4">Lead</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr
                key={`${e.ticker || e.originator_name}-${e.event_date}-${i}`}
                className="border-t border-[color:var(--color-line)]"
              >
                <td className="py-2 pr-4 text-[color:var(--color-fg)]">
                  {e.event_url ? (
                    <a href={e.event_url} target="_blank" rel="noreferrer" className="hover:text-[color:var(--color-accent)]">
                      {e.originator_name}{e.ticker ? ` (${e.ticker})` : ""} ↗
                    </a>
                  ) : (
                    <>{e.originator_name}{e.ticker ? ` (${e.ticker})` : ""}</>
                  )}
                  <div className="text-[11px] text-[color:var(--color-fg-faint)]">
                    {e.confirmed ? "✓ " : ""}
                    {EVENT_LABEL[e.event_type] || e.event_type}
                  </div>
                </td>
                <td className="py-2 pr-4 text-[color:var(--color-fg-dim)] whitespace-nowrap">
                  {e.event_date}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {e.predicted ? (
                    <span className="font-mono text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-success)] text-[color:var(--color-success)]">
                      ✓ Flagged
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-faint)]">
                      Missed
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-[color:var(--color-fg-dim)]">
                  {e.predicted ? (
                    <>
                      {LEADING_LABEL[e.leading_type || ""] || e.leading_type}
                      {typeof e.leading_yoy_pct === "number" ? ` · +${Math.round(e.leading_yoy_pct)}% YoY` : ""}
                      {e.leading_date ? (
                        <div className="text-[11px] text-[color:var(--color-fg-faint)]">flagged {e.leading_date}</div>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4 font-mono text-[color:var(--color-fg)] whitespace-nowrap">
                  {e.lead_days !== null ? `${e.lead_days}d` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-[color:var(--color-fg-faint)] leading-relaxed max-w-3xl">
        Population: {tr.population} Updated {tr.generated_at.slice(0, 10)}.
      </p>
    </section>
  );
}
