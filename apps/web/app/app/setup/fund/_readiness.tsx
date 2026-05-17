"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tradeline.fund_readiness.v1";

export type MilestoneItem = { id: string; label: string };

export function ReadinessScorecard({
  milestones,
}: {
  milestones: MilestoneItem[];
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const completed = milestones.filter((m) => done[m.id]).length;
  const total = milestones.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const verdict =
    completed === 0
      ? "You're at Year 1. Operate first; the fund comes later."
      : completed < 3
        ? "Early operating. Keep deploying your own capital and document everything."
        : completed < 5
          ? "Year 2-3 territory. Start scoping audit + servicer relationships."
          : completed < 7
            ? "Pre-fund readiness. Begin talking to fund counsel — quietly."
            : "Fund-formation-ready. The gates LPs ask about are open.";

  return (
    <section
      className="mb-10 rounded-xl p-6"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-accent)]">
            Your fund-readiness scorecard
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
            Tick off the milestones you&rsquo;ve actually completed. Every LP
            asks about these eight gates. Persisted to this browser; no
            account needed.
          </p>
        </div>
        {hydrated && (
          <div className="text-right">
            <div className="font-mono text-2xl text-[color:var(--color-accent)]">
              {completed}/{total}
            </div>
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              {pct}% ready
            </div>
          </div>
        )}
      </div>

      {hydrated && (
        <>
          <div className="mt-4 h-1.5 w-full rounded-full bg-[color:var(--color-bg-2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: "var(--gradient-primary)",
              }}
            />
          </div>

          <ul className="mt-5 space-y-1.5">
            {milestones.map((m, i) => {
              const checked = !!done[m.id];
              return (
                <li key={m.id}>
                  <label className="flex items-start gap-3 cursor-pointer group py-1.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m.id)}
                      className="mt-1 accent-[color:var(--color-accent)] shrink-0"
                    />
                    <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-wider w-6 shrink-0 pt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`text-[13px] leading-relaxed transition ${
                        checked
                          ? "text-[color:var(--color-fg-faint)] line-through"
                          : "text-[color:var(--color-fg)] group-hover:text-[color:var(--color-accent)]"
                      }`}
                    >
                      {m.label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 text-[13px] text-[color:var(--color-fg)] leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mr-2">
              Where you are
            </span>
            {verdict}
          </p>
        </>
      )}
    </section>
  );
}
