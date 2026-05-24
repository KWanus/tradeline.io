import Link from "next/link";
import type { ReactNode } from "react";
import { CountUp } from "./count-up";

export type StatTone = "default" | "success" | "warn" | "danger" | "accent";

/**
 * Compact summary tile — big number + label + optional delta + optional link.
 * Use in a grid above page bodies to give a dashboard-style overview:
 *
 *   <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
 *     <StatCard value={1247} label="Banks tracked" delta="+12 this week" />
 *     <StatCard value={3} label="Strong signal" tone="success" />
 *     <StatCard value={12} label="Watching" tone="warn" />
 *     <StatCard value="$4.2k" label="MRR" tone="accent" href="/app/billing" />
 *   </div>
 *
 * Numeric values display with tabular figures so columns line up.
 */
export function StatCard({
  value,
  label,
  delta,
  tone = "default",
  href,
  icon,
  className = "",
}: {
  value: string | number;
  label: string;
  delta?: string;
  tone?: StatTone;
  href?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const valueTone =
    tone === "success"
      ? "text-[color:var(--color-success)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : tone === "danger"
          ? "text-[color:var(--color-danger)]"
          : tone === "accent"
            ? "text-[color:var(--color-accent)]"
            : "text-[color:var(--color-fg)]";

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          {label}
        </div>
        {icon && (
          <span
            aria-hidden
            className="text-[14px] leading-none text-[color:var(--color-fg-faint)]"
          >
            {icon}
          </span>
        )}
      </div>
      <div className={`tick text-[28px] md:text-[32px] font-semibold leading-none ${valueTone}`}>
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
      {delta && (
        <div className="mt-2 font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-fg-faint)]">
          {delta}
        </div>
      )}
    </>
  );

  const cls = `card p-4 md:p-5 block ${href ? "lift-on-hover" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
