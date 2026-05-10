"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tradeline.path_progress.v1";

export function usePathProgress() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCompleted(new Set(arr));
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  }, [completed, hydrated]);

  const toggle = (id: string) =>
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return { completed, hydrated, toggle };
}

export function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : (completed / total) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Your progress
        </div>
        <div className="font-mono text-[13px] text-[color:var(--color-fg)] tick">
          {completed} / {total} <span className="text-[color:var(--color-fg-faint)]">·</span>{" "}
          <span className="text-[color:var(--color-accent)]">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-2 bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, var(--color-accent), var(--color-accent-bright))`,
            boxShadow: "0 0 12px rgba(110, 240, 162, 0.4)",
          }}
        />
      </div>
    </div>
  );
}

export function StepCheckbox({
  stepId,
  completed,
  onToggle,
}: {
  stepId: string;
  completed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={completed ? `Mark step ${stepId} incomplete` : `Mark step ${stepId} complete`}
      className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
        completed
          ? "bg-[color:var(--color-accent)] border-[color:var(--color-accent-bright)] text-[#062014]"
          : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] text-transparent hover:text-[color:var(--color-fg-faint)]"
      }`}
    >
      {completed ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M12 5L6.5 10.5L4 8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className="text-[11px] font-mono">{stepId}</span>
      )}
    </button>
  );
}
