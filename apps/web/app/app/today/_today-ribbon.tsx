"use client";

import Link from "next/link";
import type { TodayStats } from "@/lib/today-stats";

/**
 * 7-day throughput strip — the "am I shipping?" read at the top of Today.
 * Pure render of server-computed stats: outreach sent, replies back, reply
 * rate, and a tiny per-day bar so a quiet week is visible at a glance.
 */
export function TodayRibbon({ stats }: { stats: TodayStats }) {
  const maxSent = Math.max(1, ...stats.days.map((d) => d.sent));
  const quiet = stats.sentLast7d === 0 && stats.repliesLast7d === 0;

  return (
    <section className="mb-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <Metric value={stats.sentLast7d} label="sent · 7d" />
          <Metric
            value={stats.repliesLast7d}
            label="replies · 7d"
            tone={stats.repliesLast7d > 0 ? "success" : "default"}
          />
          <Metric
            value={`${Math.round(stats.replyRate * 100)}%`}
            label="reply rate"
            tone={stats.replyRate >= 0.1 ? "success" : "default"}
          />
          <Metric
            value={stats.sentToday}
            label="sent today"
            tone={stats.sentToday > 0 ? "accent" : "default"}
          />
        </div>

        <div className="flex items-end gap-1" aria-hidden>
          {stats.days.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <div
                className="w-3.5 rounded-sm bg-[color:var(--color-accent)] opacity-80"
                style={{
                  height: `${Math.max(2, Math.round((d.sent / maxSent) * 28))}px`,
                }}
                title={`${d.label}: ${d.sent} sent · ${d.replies} replies`}
              />
              <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-[color:var(--color-fg-faint)]">
                {d.label[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {quiet && (
        <p className="mt-2 text-[11.5px] text-[color:var(--color-fg-dim)] leading-snug">
          Nothing went out this week.{" "}
          <Link
            href="/app/banks"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            Open the radar
          </Link>{" "}
          and send a few inquiries — the loop only pays if it runs.
        </p>
      )}
    </section>
  );
}

function Metric({
  value,
  label,
  tone = "default",
}: {
  value: number | string;
  label: string;
  tone?: "default" | "accent" | "success";
}) {
  const color =
    tone === "success"
      ? "text-[color:var(--color-success)]"
      : tone === "accent"
        ? "text-[color:var(--color-accent)]"
        : "text-[color:var(--color-fg)]";
  return (
    <div className="flex flex-col">
      <span className={`text-[18px] font-semibold tracking-tight leading-none ${color}`}>
        {value}
      </span>
      <span className="mt-1 font-mono text-[9px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </span>
    </div>
  );
}
