"use client";

import Link from "next/link";
import type { QueuePreview } from "@/lib/autopilot/queue-preview";

const AUDIENCE_LABEL: Record<QueuePreview["items"][number]["audience"], string> = {
  sec: "SEC bank",
  fdic: "Community bank",
  ncua: "Credit union",
};

/**
 * "Up next" — a read-only window into what autopilot would send on its next
 * run. Lets the operator sanity-check the queue (and the dry-run / paused
 * state) without leaving Today. Approving still happens in the inbox below.
 */
export function UpNextPanel({ preview }: { preview: QueuePreview }) {
  const stateBadge = preview.pausedReason
    ? { label: "paused", tone: "var(--color-warn)" }
    : !preview.enabled
      ? { label: "off", tone: "var(--color-fg-faint)" }
      : preview.dryRun
        ? { label: "dry-run", tone: "var(--color-accent)" }
        : { label: "live", tone: "var(--color-success)" };

  return (
    <section className="mb-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Up next · autopilot
          </span>
          <span
            className="font-mono text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full border"
            style={{ color: stateBadge.tone, borderColor: stateBadge.tone }}
          >
            {stateBadge.label}
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            {preview.total} queued · cap {preview.dailyCap}/run
          </span>
        </div>
        <Link
          href="/app/autopilot"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Configure →
        </Link>
      </div>

      <ul className="divide-y divide-[color:var(--color-line)]">
        {preview.items.map((item) => {
          const isSec = !item.bankKey.includes("-");
          const href = isSec
            ? `/app/banks/${item.bankKey}`
            : "/app/banks/discovered";
          return (
            <li key={item.bankKey} className="py-2.5">
              <Link
                href={href}
                className="flex items-center gap-3 group"
                title={item.subject}
              >
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-fg-faint)] w-28 shrink-0">
                  {AUDIENCE_LABEL[item.audience]}
                </span>
                <span className="text-[13px] text-[color:var(--color-fg)] flex-1 truncate group-hover:text-[color:var(--color-accent)] transition">
                  {item.bankName}
                </span>
                <span className="text-[12px] text-[color:var(--color-fg-dim)] hidden md:block flex-1 truncate">
                  {item.signalLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {preview.pausedReason && (
        <p className="mt-2 text-[11.5px] text-[color:var(--color-warn)] leading-snug">
          Paused — {preview.pausedReason}. These won&rsquo;t send until you
          resume.
        </p>
      )}
    </section>
  );
}
