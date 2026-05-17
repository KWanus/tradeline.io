import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { statusFor } from "@/lib/signal-copy";
import { PublicFooter } from "@/app/_components/public-footer";
import { CoverageList } from "./_list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Coverage · every bank Tradeline tracks · Tradeline",
  description:
    "The full list of US banks, fintechs, and specialty lenders scored by the Tradeline radar — credit-quality signals, tier, current status. Updated every 6 hours from public filings.",
  openGraph: {
    title: "Tradeline coverage · 57 banks scored from public filings",
    description:
      "Every US bank Tradeline scores for non-performing-loan divestiture probability. Updated every 6 hours.",
    type: "website" as const,
  },
};

export default async function CoveragePage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const originators = snap.originators || [];

  // Aggregates for the headline strip
  const strong = originators.filter((o) => statusFor(o) === "strong").length;
  const watching = originators.filter((o) => statusFor(o) === "watching").length;
  const quiet = originators.length - strong - watching;
  const autoDiscovered = originators.filter((o) => o.auto_discovered).length;

  // Materialize a stable view-model the client component renders + filters.
  const rows = originators
    .slice()
    .sort((a, b) => {
      // Strong first, then watching, then quiet — within each group by confidence desc.
      const sa = statusFor(a);
      const sb = statusFor(b);
      const rank: Record<string, number> = { strong: 0, watching: 1, quiet: 2 };
      if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
      return b.max_confidence - a.max_confidence;
    })
    .map((o) => ({
      ticker: o.ticker,
      name: o.name || o.ticker,
      tier: o.tier || "—",
      status: statusFor(o),
      confidence: o.max_confidence,
      filings: o.filings,
      signals: o.signals,
      news: o.news_mentions,
      lastFiledAt: o.last_filed_at || "",
      autoDiscovered: Boolean(o.auto_discovered),
    }));

  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-5xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px]">Tradeline</span>
        </Link>
        <Link
          href="/report"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Subscribe &rarr;
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-8 pb-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Coverage
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          The {originators.length} US banks{" "}
          <span className="italic text-gradient-accent">Tradeline tracks.</span>
        </h1>
        <p className="mt-5 text-[17px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-3xl">
          Scored every 6 hours from public SEC filings, XBRL charge-off
          concepts, and matched news. This page is the full list — current
          status, tier, signal counts, last filing date. Subscribe to{" "}
          <Link
            href="/report"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            /report
          </Link>{" "}
          to get the strong names in your inbox every Monday.
        </p>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)] rounded-lg overflow-hidden">
          <Stat label="Tracked" value={originators.length.toString()} accent />
          <Stat label="Strong" value={strong.toString()} tone="strong" />
          <Stat label="Watching" value={watching.toString()} tone="warn" />
          <Stat label="Auto-discovered" value={autoDiscovered.toString()} />
        </div>

        {/* The interactive list — client component so it can filter live. */}
        <div className="mt-10">
          <CoverageList rows={rows} />
        </div>

        <div className="mt-12 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-8 text-center">
          <h2 className="font-serif text-2xl md:text-3xl tracking-tight">
            Get the strong names every Monday.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-xl mx-auto">
            Free. Unsubscribe in one click. Scanned every 6 hours; published
            every Monday morning. {quiet} of the {originators.length} banks are
            quiet right now — the rest move.
          </p>
          <div className="mt-5">
            <Link
              href="/report"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#1a0c00] hover:opacity-90 transition inline-block"
              style={{ background: "var(--gradient-primary)" }}
            >
              Subscribe to the report &rarr;
            </Link>
          </div>
        </div>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          Snapshot generated {snap.generated_at?.slice(0, 16) || "—"} UTC.
          Public-source data only. Zero consumer information.
        </p>
      </section>

      <PublicFooter />
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone?: "strong" | "warn";
  accent?: boolean;
}) {
  const color = accent
    ? "text-[color:var(--color-accent)]"
    : tone === "strong"
      ? "text-[color:var(--color-accent)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] px-5 py-4">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl ${color}`}>{value}</div>
    </div>
  );
}
