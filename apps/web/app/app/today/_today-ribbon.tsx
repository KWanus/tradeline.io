import type { TodayStats } from "@/lib/today-stats";

/** Compact 7-day metric ribbon. Neutral when there's no reply activity yet. */
export function TodayRibbon({ stats }: { stats: TodayStats }) {
  const hasActivity = stats.repliesThisWeek > 0;

  return (
    <div className="mb-6 flex items-center gap-x-6 gap-y-2 flex-wrap rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-2.5">
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        Last 7 days
      </span>
      {hasActivity ? (
        <>
          <Metric value={stats.repliesThisWeek} label="replies" />
          <Metric value={stats.interestedThisWeek} label="warm" tone="success" />
        </>
      ) : (
        <span className="text-[12px] text-[color:var(--color-fg-dim)]">
          No replies yet — ship outreach from the queue below to start the loop.
        </span>
      )}
    </div>
  );
}

function Metric({
  value,
  label,
  tone = "default",
}: {
  value: number;
  label: string;
  tone?: "default" | "success";
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={`font-mono text-[15px] ${
          tone === "success"
            ? "text-[color:var(--color-success)]"
            : "text-[color:var(--color-fg)]"
        }`}
      >
        {value}
      </span>
      <span className="text-[12px] text-[color:var(--color-fg-dim)]">{label}</span>
    </span>
  );
}
