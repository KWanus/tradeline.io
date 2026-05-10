"use client";

import Link from "next/link";
import { useWatchlist } from "@/lib/bank-state";

type LiteOriginator = {
  ticker: string;
  name: string | null;
  tier?: string | null;
  status: "strong" | "watching" | "quiet";
  signal_label?: string;
  signal_action?: string;
};

const STATUS_TONE: Record<LiteOriginator["status"], string> = {
  strong: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  watching: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  quiet: "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]",
};

const STATUS_LABEL: Record<LiteOriginator["status"], string> = {
  strong: "Call now",
  watching: "Watch",
  quiet: "Skip",
};

export function WatchlistSection({ originators }: { originators: LiteOriginator[] }) {
  const [list] = useWatchlist();
  if (list.length === 0) return null;
  const matched = list
    .map((t) => originators.find((o) => o.ticker === t))
    .filter((o): o is LiteOriginator => Boolean(o));
  if (matched.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="font-serif italic text-[18px] text-[color:var(--color-fg-dim)] mb-1">
        Your watchlist
      </div>
      <p className="text-[12px] text-[color:var(--color-fg-faint)] mb-3">
        Banks you starred. Watch how their status changes over time.
      </p>
      <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
        {matched.map((o) => (
          <Link
            key={o.ticker}
            href={`/app/banks/${o.ticker}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-[color:var(--color-bg-2)] transition"
          >
            <span className="text-[color:var(--color-accent)]">★</span>
            <span className="font-mono text-[15px] text-[color:var(--color-accent)] w-14">
              {o.ticker}
            </span>
            <span className="text-[14px] text-[color:var(--color-fg)] flex-1 truncate">
              {o.name}
            </span>
            <span className="text-[13px] text-[color:var(--color-fg-dim)] hidden md:block flex-1 truncate">
              {o.signal_label || "—"}
            </span>
            <span
              className={`font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border ${STATUS_TONE[o.status]}`}
            >
              {STATUS_LABEL[o.status]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
