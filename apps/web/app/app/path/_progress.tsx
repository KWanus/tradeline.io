"use client";

import { useEffect, useState } from "react";
import { SparkleBurst } from "../_components/celebrate";

const STORAGE_KEY = "tradeline.path_progress.v1";

export function usePathProgress() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [justDoneId, setJustDoneId] = useState<string | null>(null);
  const [lastDoneTitle, setLastDoneTitle] = useState<string | null>(null);

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

  useEffect(() => {
    if (!justDoneId) return;
    const t = window.setTimeout(() => setJustDoneId(null), 1200);
    return () => window.clearTimeout(t);
  }, [justDoneId]);

  useEffect(() => {
    if (!lastDoneTitle) return;
    const t = window.setTimeout(() => setLastDoneTitle(null), 1700);
    return () => window.clearTimeout(t);
  }, [lastDoneTitle]);

  const toggle = (id: string, title?: string) => {
    let becameDone = false;
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        becameDone = true;
      }
      return next;
    });
    if (becameDone) {
      setJustDoneId(id);
      if (title) setLastDoneTitle(`Step ${id} done · ${title}`);
    }
  };

  return { completed, hydrated, toggle, justDoneId, lastDoneTitle };
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
            background: "var(--gradient-primary)",
            boxShadow: "0 0 14px rgba(var(--tint-accent-2-rgb), 0.45)",
          }}
        />
      </div>
    </div>
  );
}

export function StepCheckbox({
  stepId,
  completed,
  justDone,
  onToggle,
}: {
  stepId: string;
  completed: boolean;
  justDone?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={completed ? `Mark step ${stepId} incomplete` : `Mark step ${stepId} complete`}
      className={`relative shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
        completed
          ? "bg-[color:var(--color-success)] border-[color:var(--color-success-dim)] text-[color:var(--color-bg)]"
          : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] text-transparent hover:text-[color:var(--color-fg-faint)]"
      } ${justDone ? "animate-check-pop" : ""}`}
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
      {justDone && <SparkleBurst />}
    </button>
  );
}
