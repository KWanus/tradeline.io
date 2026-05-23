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
 * credit union sharing a numeric id never collide. */
function strongestPerInstitution(
  signals: (FdicSignal | NcuaSignal)[]
): (FdicSignal | NcuaSignal)[] {
  const byKey = new Map<string, FdicSignal | NcuaSignal>();
  for (const s of signals) {
    const existing = byKey.get(s.ticker);
    if (!existing || s.confidence > existing.confidence) {
      byKey.set(s.ticker, s);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => b.confidence - a.confidence
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
          {banks.map((s) => (
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
          ))}
        </div>
      )}
    </section>
  );
}
