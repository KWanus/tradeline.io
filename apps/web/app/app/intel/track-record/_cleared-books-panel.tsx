import type { ClearedBooks } from "@/lib/snapshot";

function fmtUsd(thousands: number): string {
  const d = thousands * 1000;
  if (d >= 1_000_000_000) return `$${(d / 1_000_000_000).toFixed(1)}B`;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(d / 1000)}K`;
}

/** Standalone supply intelligence derived purely from public FDIC Call Reports:
 * flagged institutions whose noncurrent-loan book dropped sharply this quarter
 * — they sold or wrote off the distressed paper. No partner feed required. */
export function ClearedBooksPanel({ cb }: { cb?: ClearedBooks }) {
  if (!cb || cb.count === 0) return null;

  return (
    <section className="mt-14">
      <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        Public-data disposition proxy · FDIC Call Reports
      </div>
      <h2 className="mt-2 font-serif text-3xl tracking-tight text-[color:var(--color-fg)]">
        {cb.count} flagged institutions cleared their distressed book.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-3xl leading-relaxed">
        We can&rsquo;t see private charge-off sales directly — but we can see
        their footprint. These institutions we&rsquo;d flagged showed a sharp
        quarter-over-quarter drop in noncurrent loans as of {cb.as_of}: the bad
        book left the balance sheet (sold or written off). It&rsquo;s a{" "}
        <em>proxy</em>, not a confirmed sale — but it needs no partner feed, no
        scraping, just the public Call Report. A drop right after a flag is the
        supply footprint worth a call.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)]">
              <th className="py-2 pr-4">Institution</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Noncurrent loans</th>
              <th className="py-2 pr-4">Drop</th>
            </tr>
          </thead>
          <tbody>
            {cb.top.map((b) => (
              <tr key={b.cert} className="border-t border-[color:var(--color-line)]">
                <td className="py-2 pr-4 text-[color:var(--color-fg)]">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[color:var(--color-accent)]"
                  >
                    {b.originator_name} ↗
                  </a>
                </td>
                <td className="py-2 pr-4 text-[color:var(--color-fg-dim)]">{b.state}</td>
                <td className="py-2 pr-4 font-mono text-[color:var(--color-fg-dim)] whitespace-nowrap">
                  {fmtUsd(b.noncurrent_prior)} → {fmtUsd(b.noncurrent_latest)}
                </td>
                <td className="py-2 pr-4 font-mono text-[color:var(--color-warn)] whitespace-nowrap">
                  −{Math.round(b.drop_pct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
