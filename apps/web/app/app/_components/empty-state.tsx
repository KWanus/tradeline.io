import Link from "next/link";
import type { ReactNode } from "react";

export type EmptyStateAction = {
  label: string;
  href: string;
};

/**
 * Canonical "no data yet" surface. Use anywhere a list, board, or feed has
 * zero items so the empty state reads consistently across the app.
 *
 * Three tones:
 *   - default   : neutral glass card. "Nothing here yet — come back later."
 *   - waiting   : amber dot. "Working on it — first run usually takes ~6h."
 *   - done      : success dot. "Inbox zero — you shipped today's queue."
 *
 *   <EmptyState
 *     icon={<Inbox />}
 *     title="Inbox zero"
 *     description="Radar runs every 6 hours. Drafts queue here as they're generated."
 *     tone="done"
 *     primary={{ label: "Browse banks", href: "/app/banks" }}
 *   />
 */
export function EmptyState({
  icon,
  title,
  description,
  primary,
  secondary,
  tone = "default",
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  primary?: EmptyStateAction;
  secondary?: EmptyStateAction;
  tone?: "default" | "waiting" | "done";
  className?: string;
}) {
  const dot =
    tone === "done"
      ? "bg-[color:var(--color-success)] glow"
      : tone === "waiting"
        ? "bg-[color:var(--color-warn)]"
        : "bg-[color:var(--color-fg-faint)]";

  return (
    <div
      className={`card-elevated relative overflow-hidden py-12 px-6 text-center ${className}`}
    >
      <div className="flex items-center justify-center gap-2 mb-3 font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span>
          {tone === "done"
            ? "All clear"
            : tone === "waiting"
              ? "Working on it"
              : "Nothing yet"}
        </span>
      </div>

      {icon && (
        <div
          className="text-[40px] leading-none text-[color:var(--color-fg-faint)] mb-3"
          aria-hidden
        >
          {icon}
        </div>
      )}

      <h3 className="text-[18px] md:text-[20px] font-semibold tracking-tight text-[color:var(--color-fg)]">
        {title}
      </h3>

      {description && (
        <p className="mt-2 text-[13px] md:text-[14px] text-[color:var(--color-fg-dim)] max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}

      {(primary || secondary) && (
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
          {primary && (
            <Link href={primary.href} className="btn-primary">
              {primary.label}
            </Link>
          )}
          {secondary && (
            <Link href={secondary.href} className="btn-secondary">
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
