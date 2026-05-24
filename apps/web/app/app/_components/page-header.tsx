import Link from "next/link";
import type { ReactNode } from "react";

export type PageHeaderTab = {
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
};

export type PageHeaderBadge = {
  label: string;
  tone?: "primary" | "success" | "warn" | "danger" | "neutral";
};

/**
 * Canonical page chrome — icon · title · badge · tagline + optional tabs +
 * optional right-aligned meta slot. Use as the first child of every /app/*
 * page so the entry rhythm is identical everywhere.
 *
 *   <PageHeader
 *     icon={<Inbox />}
 *     title="Today"
 *     badge={{ label: "Live", tone: "success" }}
 *     tagline="4 actions ready to approve and ship."
 *     tabs={[{ label: "Queue", href: "/app/today", active: true }]}
 *     meta={<TimeBadge />}
 *   />
 */
export function PageHeader({
  icon,
  title,
  badge,
  tagline,
  tabs,
  meta,
}: {
  icon?: ReactNode;
  title: string;
  badge?: PageHeaderBadge;
  tagline?: string;
  tabs?: PageHeaderTab[];
  meta?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          {icon && (
            <span
              aria-hidden
              className="text-[color:var(--color-accent)] text-[22px] leading-none translate-y-1"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-semibold text-[26px] md:text-[30px] tracking-tight text-[color:var(--color-fg)] leading-none">
                {title}
              </h1>
              {badge && <Badge {...badge} />}
            </div>
            {tagline && (
              <p className="mt-1.5 text-[13px] md:text-[14px] text-[color:var(--color-fg-dim)] leading-snug">
                {tagline}
              </p>
            )}
          </div>
        </div>
        {meta && <div className="shrink-0 flex items-center gap-2">{meta}</div>}
      </div>

      {tabs && tabs.length > 0 && (
        <nav className="mt-5 flex gap-1.5 flex-wrap">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                tab.active
                  ? "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium text-[#0a0c14] shadow-[0_6px_18px_-6px_rgba(var(--tint-accent-rgb),0.55)] transition"
                  : "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] text-[color:var(--color-fg-dim)] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] hover:text-[color:var(--color-fg)] hover:border-[color:var(--color-line-strong)] transition"
              }
              style={
                tab.active
                  ? { background: "var(--gradient-primary)" }
                  : undefined
              }
            >
              {tab.icon && (
                <span aria-hidden className="text-[14px] leading-none">
                  {tab.icon}
                </span>
              )}
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function Badge({ label, tone = "primary" }: PageHeaderBadge) {
  if (tone === "primary") {
    return (
      <span
        className="font-mono text-[9px] tracking-[0.20em] uppercase font-bold px-2 py-0.5 rounded-full text-[#0a0c14]"
        style={{ background: "var(--gradient-primary)" }}
      >
        {label}
      </span>
    );
  }
  const palette: Record<
    Exclude<NonNullable<PageHeaderBadge["tone"]>, "primary">,
    string
  > = {
    success:
      "border border-[color:var(--color-success-dim)] text-[color:var(--color-success)] bg-[color:var(--color-success-soft)]",
    warn: "border border-[color:var(--color-warn)] text-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]",
    danger:
      "border border-[color:var(--color-danger)] text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)]",
    neutral:
      "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] bg-[color:var(--color-bg-1)]",
  };
  return (
    <span
      className={`font-mono text-[9px] tracking-[0.20em] uppercase font-bold px-2 py-0.5 rounded-full ${palette[tone]}`}
    >
      {label}
    </span>
  );
}
