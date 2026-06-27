import Link from "next/link";

import type { QueuePreview } from "@/lib/autopilot/queue-preview";

/**
 * "Up next" — what the autopilot batch would send on its next run, shown
 * inline on Today so the operator sees the queue without leaving the page.
 * Pure presentational; data comes from computeQueuePreview().
 */
export function UpNextPanel({ preview }: { preview: QueuePreview }) {
  if (preview.items.length === 0) return null;

  const statusLabel = !preview.enabled
    ? "Autopilot off"
    : preview.dryRun
      ? "Dry-run"
      : "Live";

  return (
    <section className="mb-6 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Up next · autopilot
          </span>
          <span
            className={`font-mono text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full border ${
              preview.enabled && !preview.dryRun
                ? "border-[color:var(--color-success-dim)] text-[color:var(--color-success)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-fg-faint)]"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <Link
          href="/app/autopilot"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
        >
          Configure →
        </Link>
      </div>

      <ul className="divide-y divide-[color:var(--color-line)]">
        {preview.items.map((it) => (
          <li key={it.ticker} className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[13px] text-[color:var(--color-accent)] w-12">
              {it.ticker}
            </span>
            <span className="text-[13px] text-[color:var(--color-fg)] truncate flex-1 min-w-0">
              {it.name}
            </span>
            <span className="text-[12px] text-[color:var(--color-fg-dim)] truncate hidden md:block max-w-[45%]">
              {it.reason}
            </span>
          </li>
        ))}
      </ul>

      {preview.total > preview.items.length && (
        <div className="mt-2 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          +{preview.total - preview.items.length} more in queue · cap{" "}
          {preview.dailyCap}/run
        </div>
      )}
    </section>
  );
}
