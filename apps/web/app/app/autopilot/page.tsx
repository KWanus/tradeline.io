import Link from "next/link";

import {
  type Dimension,
  MIN_SAMPLES,
  type PatternStats,
  computePatternStats,
} from "@/lib/autopilot/pattern-performance";
import { PageHeader } from "../_components/page-header";
import { AutopilotPanel } from "./_panel";

export const dynamic = "force-dynamic";

export default async function AutopilotPage() {
  let stats: PatternStats | null = null;
  try {
    stats = await computePatternStats();
  } catch {}

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageHeader
        icon={<span aria-hidden>↻</span>}
        title="Autopilot"
        badge={{ label: "Control", tone: "primary" }}
        tagline="Schedule, cap, and pause the daily outreach loop. You stay in the loop — replies route to your inbox."
        meta={
          <Link
            href="/app/learn#autopilot"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            How it runs →
          </Link>
        }
      />

      <AutopilotPanel />

      {stats && <PatternDashboard stats={stats} />}
    </main>
  );
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AUDIENCE_LABELS: Record<string, string> = {
  sec: "SEC banks",
  fdic: "FDIC community banks",
  ncua: "Credit unions",
};

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function formatLift(lift: number): { text: string; tone: string } {
  const pct = Math.round(lift * 100);
  if (pct > 0) {
    return { text: `+${pct}% lift`, tone: "text-[color:var(--color-success)]" };
  }
  if (pct < 0) {
    return { text: `${pct}% lift`, tone: "text-[color:var(--color-warn)]" };
  }
  return { text: "neutral", tone: "text-[color:var(--color-fg-faint)]" };
}

function labelFor(dim: Dimension, value: string): string {
  if (dim === "audience") return AUDIENCE_LABELS[value] || value;
  if (dim === "dow") {
    const i = Number(value);
    return Number.isFinite(i) && i >= 0 && i < 7 ? DOW_LABELS[i] : value;
  }
  if (dim === "hour") {
    const i = Number(value);
    return Number.isFinite(i) ? `${String(i).padStart(2, "0")}:00 UTC` : value;
  }
  return value;
}

function PatternDashboard({ stats }: { stats: PatternStats }) {
  const { decisiveCount, globalReplyRate, lifts, buckets } = stats;

  if (decisiveCount === 0) {
    return (
      <section className="mt-12 rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Pattern performance
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-xl">
          No labeled outreach yet. Send a few from{" "}
          <Link
            href="/app/today"
            className="text-[color:var(--color-accent)] underline"
          >
            today
          </Link>{" "}
          and tag replies in the resolved drawer — once {MIN_SAMPLES} sends
          accumulate in a slice (audience, state, day, hour), reply lift
          starts re-ranking the inbox.
        </p>
      </section>
    );
  }

  const sliceOrder: Dimension[] = ["audience", "state", "dow", "hour"];

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Pattern performance
          </div>
          <h2 className="mt-1 font-semibold text-2xl tracking-tight text-[color:var(--color-fg)]">
            {formatPct(globalReplyRate)} reply rate
            <span className="ml-2 font-mono text-[12px] tracking-normal text-[color:var(--color-fg-faint)]">
              across {decisiveCount} decisive sends
            </span>
          </h2>
          <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] max-w-xl leading-relaxed">
            Slices with {MIN_SAMPLES}+ sends drive lift in the inbox. Replies
            count automatically; sends 14d+ old with no label count as no-reply.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sliceOrder.map((dim) => (
          <DimensionPanel
            key={dim}
            dim={dim}
            bucket={buckets[dim]}
            lifts={lifts[dim] || {}}
          />
        ))}
      </div>
    </section>
  );
}

function DimensionPanel({
  dim,
  bucket,
  lifts,
}: {
  dim: Dimension;
  bucket: Record<string, { total: number; positive: number }>;
  lifts: Record<string, number>;
}) {
  const entries = Object.entries(bucket).sort((a, b) => b[1].total - a[1].total);
  const dimLabel =
    dim === "audience"
      ? "By audience"
      : dim === "state"
        ? "By state"
        : dim === "dow"
          ? "By day of week (UTC)"
          : "By hour of day (UTC)";

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          {dimLabel}
        </div>
        <div className="text-[12px] text-[color:var(--color-fg-faint)]">
          No data
        </div>
      </div>
    );
  }

  // Cap row count so a noisy dimension (hour: up to 24 buckets) stays scannable.
  const visible = entries.slice(0, 8);

  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
        {dimLabel}
      </div>
      <ul className="space-y-2">
        {visible.map(([value, { total, positive }]) => {
          const rate = total === 0 ? 0 : positive / total;
          const liftVal = lifts[value];
          const hasLift = typeof liftVal === "number";
          const shortBy = MIN_SAMPLES - total;
          const liftCopy = hasLift
            ? formatLift(liftVal)
            : shortBy > 0
              ? {
                  text: `${shortBy} more for lift`,
                  tone: "text-[color:var(--color-fg-faint)]",
                }
              : { text: "—", tone: "text-[color:var(--color-fg-faint)]" };
          return (
            <li
              key={value}
              className="flex items-center gap-3 text-[13px]"
            >
              <span className="font-mono text-[12px] text-[color:var(--color-fg)] min-w-[80px] truncate">
                {labelFor(dim, value)}
              </span>
              <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)] min-w-[44px] text-right">
                {formatPct(rate)}
              </span>
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-fg-faint)]">
                {positive}/{total}
              </span>
              <span
                className={`ml-auto font-mono text-[10px] tracking-[0.14em] uppercase ${liftCopy.tone}`}
              >
                {liftCopy.text}
              </span>
            </li>
          );
        })}
      </ul>
      {entries.length > visible.length && (
        <div className="mt-2 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          +{entries.length - visible.length} more buckets
        </div>
      )}
    </div>
  );
}
