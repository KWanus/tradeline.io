import Link from "next/link";
import { PageHeader } from "../../_components/page-header";
import {
  EMPTY_SNAPSHOT,
  type RadarSnapshot,
  readSnapshot,
} from "@/lib/snapshot";
import { CandidateCard } from "./_candidate-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DiscoveredPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const promoted = snap.candidates_promoted || [];
  const pending = snap.candidates_pending || [];
  const lastRun = snap.generated_at
    ? new Date(snap.generated_at).toISOString().slice(0, 19).replace("T", " ")
    : "never";

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>◈</span>}
        title="Discovered"
        badge={{ label: "Auto", tone: "primary" }}
        tagline="Banks the SEC EDGAR scanner found in the last 90 days but not yet on your watchlist."
        meta={
          <Link
            href="/app/learn#discovered"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            How discovery works →
          </Link>
        }
      />

      <section className="mb-10">
        <SectionHeader
          label="Auto-promoted"
          count={promoted.length}
          subtitle="Now being tracked on the main radar."
        />
        {promoted.length === 0 ? (
          <EmptyState
            text="No auto-promotions yet. The scanner needs to encounter an 8-K item 2.01 or 2.06 with NPL keywords from a non-tracked bank — those are uncommon. Check back daily."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {promoted.map((c) => (
              <CandidateCard key={c.accession} c={c} promoted />
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionHeader
          label="Pending review"
          count={pending.length}
          subtitle="Medium-confidence finds. Read the filing before deciding."
        />
        {pending.length === 0 ? (
          <EmptyState text="No candidates pending review." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pending.map((c) => (
              <CandidateCard key={c.accession} c={c} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 text-[13px] text-[color:var(--color-fg-dim)]">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
          What this scanner cannot find
        </div>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong>Privately-held debt issuers</strong> (most credit unions,
            some specialty lenders) — they don&rsquo;t file with SEC.
          </li>
          <li>
            <strong>Banks selling debt through brokers without disclosing</strong>{" "}
            — Item 2.01 is required only above materiality thresholds, so small
            sales fly under the radar.
          </li>
          <li>
            <strong>Pre-divestiture posturing</strong> (10-Q charge-off increases
            without an 8-K) — those are already captured by the main signals
            worker for your tracked banks; this scanner only looks at fresh 8-Ks.
          </li>
        </ul>
        <p className="mt-3">
          Last scan: <span className="font-mono text-[color:var(--color-fg)]">{lastRun} UTC</span>
        </p>
      </section>
    </main>
  );
}

function SectionHeader({
  label,
  count,
  subtitle,
}: {
  label: string;
  count: number;
  subtitle: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="font-semibold text-[20px] text-[color:var(--color-fg)]">
          {label}
        </div>
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          {count} {count === 1 ? "entry" : "entries"}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[color:var(--color-fg-faint)]">
        {subtitle}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-8 text-center text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
      {text}
    </div>
  );
}
