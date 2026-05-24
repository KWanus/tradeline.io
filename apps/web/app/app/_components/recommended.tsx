import type { ReactNode } from "react";

// Visual treatment for "what you should do right now" sections that appear
// at the top of list pages. Pops with the brand gradient border + soft
// halo and a sticky label so the eye lands here first.

export function RecommendedSection({
  label = "Recommended",
  title,
  subtitle,
  count,
  children,
  empty,
}: {
  label?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  count?: number;
  children: ReactNode;
  empty?: ReactNode;
}) {
  const isEmpty =
    count === 0 ||
    (Array.isArray(children) && children.length === 0) ||
    children === null ||
    children === undefined;

  return (
    <section className="relative mb-8">
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl opacity-30 blur-lg pointer-events-none"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div
        className="relative rounded-2xl p-5 md:p-6"
        style={{
          background:
            "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase">
              <span
                className="px-2 py-0.5 rounded-full text-[#0a0c14] font-semibold"
                style={{ background: "var(--gradient-primary)" }}
              >
                {label}
              </span>
              {typeof count === "number" && count > 0 && (
                <span className="text-[color:var(--color-fg-faint)]">
                  · {count} {count === 1 ? "item" : "items"}
                </span>
              )}
            </div>
            <h2 className="mt-2 font-semibold text-xl md:text-2xl text-[color:var(--color-fg)] tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {isEmpty ? (
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-5 py-6 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {empty || "Nothing urgent right now. Check back tomorrow."}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function HighlightCardClass(extra = "") {
  return `relative block p-5 rounded-xl bg-[color:var(--color-bg-1)] transition group hover:-translate-y-0.5 hover:shadow-[0_14px_44px_-10px_rgba(var(--tint-accent-rgb),0.5)] ${extra}`;
}

export function HighlightCardWrapper({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1px solid transparent",
        borderRadius: "12px",
      }}
    >
      {children}
    </div>
  );
}
