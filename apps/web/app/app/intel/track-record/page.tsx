import Link from "next/link";
import { TrackRecordBoard } from "./_board";
import { BacktestPanel } from "./_backtest-panel";
import { ClearedBooksPanel } from "./_cleared-books-panel";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TrackRecordPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  return (
    <main className="px-6 md:px-10 lg:px-14 py-12 max-w-5xl">
      <header className="mb-12">
        <Link
          href="/app/intel"
          className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
        >
          &larr; Back to Intel
        </Link>
        <div className="mt-3 text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Falsifiable signal · proof of work
        </div>
        <h1 className="mt-4 font-serif text-4xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
          Predictions{" "}
          <span className="italic text-[color:var(--color-accent)]">
            vs. reality
          </span>
          .
        </h1>
        <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-3xl">
          Per the competitive research, the single feature that turns Radar from
          a feed into a track record customers can show their LP / credit
          committee is a <em>falsifiable</em> match log. When Radar flags a bank,
          you log the prediction. When that bank actually lists on EverChain /
          Debexpert / NLEX / Garnet, you record the match. The hit rate becomes
          a public stat customers trust.
        </p>
      </header>

      <BacktestPanel tr={snap.track_record} />

      <ClearedBooksPanel cb={snap.cleared_books} />

      <div className="my-14 border-t border-[color:var(--color-line)]" />

      <div className="mb-6 text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        Manual match log · marketplace listings
      </div>
      <TrackRecordBoard />

      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-6">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            How match score is computed
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>
              <strong className="text-[color:var(--color-fg)]">Asset class match (40%)</strong>{" "}
              — predicted vs. actual asset class. Loose matching across similar
              classes (e.g. mortgage / real estate) but no cross-class credit.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Face value (30%)</strong>{" "}
              — full credit if actual face is within predicted min/max. Partial
              credit if within ±30% of bounds.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Region overlap (20%)</strong>{" "}
              — token-level overlap between predicted and actual regions.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Recency (10%)</strong>{" "}
              — 100% within 30 days of flag, declining to 15% past a year.
            </li>
          </ul>
        </div>
        <div className="card p-6">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Phase 2 — automation
          </div>
          <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>
              <strong className="text-[color:var(--color-fg)]">EverChain + Debexpert ingestion.</strong>{" "}
              Either via partner API (preferred — pursue partnership) or
              periodic polling of public listing pages. Auto-create predictions
              when Radar fires; auto-create matches when listings appear.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">NLEX scraping</strong>{" "}
              of public bidder packets to extract asset class + face value and
              tag matches.
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Public-facing hit-rate widget</strong>{" "}
              embedded on /report and /app/intel as social proof. "Tradeline
              flagged 73% of last quarter&rsquo;s NPL listings 47 days early."
            </li>
            <li>
              <strong className="text-[color:var(--color-fg)]">Per-customer attribution.</strong>{" "}
              Customers see their Radar alerts that became real listings — the
              receipts they show their credit committee.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
