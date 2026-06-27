import Link from "next/link";

import type { TodayStats } from "@/lib/today-stats";

/**
 * Thin 7-day metric ribbon above the role-gated content: sends, replies, reply
 * rate, and anything pending. Pure presentational; data from computeTodayStats().
 */
export function TodayRibbon({ stats }: { stats: TodayStats }) {
  const replyPct = Math.round(stats.replyRate * 100);

  const cells: {
    label: string;
    value: string;
    href?: string;
    tone?: "accent" | "success";
  }[] = [
    { label: "Sent · 7d", value: String(stats.sent7d), href: "/app/autopilot" },
    {
      label: "Replies · 7d",
      value: String(stats.replies7d),
      href: "/app/inbox/replies",
      tone: stats.replies7d > 0 ? "success" : undefined,
    },
    {
      label: "Reply rate",
      value: stats.sent7d > 0 ? `${replyPct}%` : "—",
      tone: replyPct >= 10 ? "success" : undefined,
    },
    {
      label: "Pending replies",
      value: String(stats.pendingReplies),
      href: "/app/inbox/replies",
      tone: stats.pendingReplies > 0 ? "accent" : undefined,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)] rounded-xl overflow-hidden">
      {cells.map((c) => {
        const toneColor =
          c.tone === "success"
            ? "text-[color:var(--color-success)]"
            : c.tone === "accent"
              ? "text-[color:var(--color-accent)]"
              : "text-[color:var(--color-fg)]";
        const inner = (
          <div className="bg-[color:var(--color-bg-1)] px-4 py-3 h-full">
            <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[color:var(--color-fg-faint)]">
              {c.label}
            </div>
            <div className={`mt-1 font-mono text-xl ${toneColor}`}>{c.value}</div>
          </div>
        );
        return c.href ? (
          <Link
            key={c.label}
            href={c.href}
            className="block hover:bg-[color:var(--color-bg-2)] transition"
          >
            {inner}
          </Link>
        ) : (
          <div key={c.label}>{inner}</div>
        );
      })}
    </div>
  );
}
