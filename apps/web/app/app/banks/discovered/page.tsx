import Link from "next/link";
import { PageIntro } from "../../_components/page-intro";
import {
  EMPTY_SNAPSHOT,
  type Candidate,
  type RadarSnapshot,
  readSnapshot,
} from "@/lib/snapshot";
import { relativeAge } from "@/lib/signal-copy";

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
      <PageIntro
        eyebrow="Auto scan"
        title={<>Banks the radar found on its own.</>}
        lead={
          <>
            Every 6 hours, a worker scans SEC EDGAR&rsquo;s live 8-K feed for
            bank-sector filings with non-performing-loan keywords. Banks not
            already on your seed list get queued here.{" "}
            <strong className="text-[color:var(--color-accent)]">Promoted</strong>{" "}
            entries are now tracked alongside your 31. <strong>Pending</strong>{" "}
            entries need a glance before they join the list.
          </>
        }
        doNow={
          promoted.length === 0 && pending.length === 0
            ? "Nothing yet. The scanner just finished its first pass. New finds will appear within 6 hours."
            : promoted.length > 0
              ? `${promoted.length} bank${promoted.length === 1 ? "" : "s"} auto-promoted recently — review and remove false positives if any.`
              : `${pending.length} pending candidate${pending.length === 1 ? "" : "s"}. Click an item to read the filing that triggered it.`
        }
        howThisWorks={
          <>
            <p>
              The scanner looks at SEC&rsquo;s most recent 100 8-K filings every
              run. For each:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Checks the company&rsquo;s SIC code — must be banking, lending,
                or finance (e.g. 6020, 6021, 6141, 6712).
              </li>
              <li>
                Checks the 8-K items — only signals on 2.01 (disposition), 2.06
                (material impairment), 7.01 (FD), or 8.01 (other events).
              </li>
              <li>
                Checks the filing description for NPL keywords (charge-off,
                non-performing, portfolio sale, divestiture, loan loss).
              </li>
              <li>
                Scores it — high (≥0.7) auto-promotes; medium (0.5) goes pending.
              </li>
            </ul>
            <p>
              Auto-promoted tickers are written to{" "}
              <code className="font-mono text-[12px] text-[color:var(--color-fg)]">
                data/seed/banks_auto.csv
              </code>{" "}
              which the next radar run picks up. To remove a false positive,
              delete its row from that file.
            </p>
          </>
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
        <div className="font-serif italic text-[20px] text-[color:var(--color-fg)]">
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

function CandidateCard({ c, promoted }: { c: Candidate; promoted?: boolean }) {
  const confTone =
    c.confidence >= 0.7
      ? "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]"
      : c.confidence >= 0.5
        ? "text-[color:var(--color-warn)] border-[color:var(--color-warn)]"
        : "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]";

  return (
    <article
      className={`p-5 rounded-lg border bg-[color:var(--color-bg-1)] transition ${
        promoted
          ? "border-[color:var(--color-accent-dim)]"
          : "border-[color:var(--color-line)]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          {c.ticker ? (
            <Link
              href={`/app/banks/${c.ticker}`}
              className="font-mono text-xl text-[color:var(--color-accent)] hover:underline"
            >
              {c.ticker}
            </Link>
          ) : (
            <span className="font-mono text-[12px] text-[color:var(--color-fg-faint)]">
              CIK {c.cik}
            </span>
          )}
          {promoted && (
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)]">
              Auto
            </span>
          )}
        </div>
        <span
          className={`font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border ${confTone}`}
        >
          conf {c.confidence.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 text-[14px] text-[color:var(--color-fg)] line-clamp-1">
        {c.name}
      </div>
      <div className="mt-2 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        SIC {c.sic} · {c.form_type} · items {c.items.join(", ")} · {relativeAge(c.filed_at)}
      </div>
      <p className="mt-3 text-[12px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-3">
        {c.description}
      </p>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          Read filing ↗
        </a>
        {c.ticker && (
          <Link
            href={`/app/banks/${c.ticker}`}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)] transition"
          >
            See bank →
          </Link>
        )}
      </div>
    </article>
  );
}
