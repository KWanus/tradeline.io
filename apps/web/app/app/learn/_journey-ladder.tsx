"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "tradeline.journey.v1";

type Step = {
  id: string;
  label: string;
  time: string;
  why: string;
  href: string;
  cta: string;
};

const STEPS: Step[] = [
  {
    id: "license",
    label: "Step 1 — Get your state license",
    time: "2-6 months",
    why: "You can't legally buy or collect consumer debt in most states without a debt-buyer license. Costs $1k–$10k filing + a $5k–$50k surety bond depending on the state. Without it, no broker will sell to you.",
    href: "/app/setup/license",
    cta: "Open state playbooks",
  },
  {
    id: "brokers",
    label: "Step 2 — Build broker relationships",
    time: "3-6 months overlapping with Step 1",
    why: "Most deals don't happen via auction; they happen via relationship. Go to an RMAI conference, send licensed-buyer profiles to brokers, get on their lists. Tradeline's Brokers page lists the 9 majors.",
    href: "/app/brokers",
    cta: "Open broker directory",
  },
  {
    id: "first-deal",
    label: "Step 3 — First small deal",
    time: "month 6-9",
    why: "Start small — a $1M-face tape for $30-50k. Use Tradeline's tape copilot to evaluate it. Set up a third-party servicer. Don't use leverage yet — just close one deal cleanly.",
    href: "/app/tools/tape",
    cta: "Open tape copilot",
  },
  {
    id: "track-record",
    label: "Step 4 — Build a track record",
    time: "months 9-24",
    why: "3-5 closed deals from different brokers. Each one strengthens your reputation and gives you operating data to underwrite bigger tapes. This is also when you start tracking compliance actively.",
    href: "/app/pipeline",
    cta: "Open pipeline",
  },
  {
    id: "hypothecate",
    label: "Step 5 — Hypothecate",
    time: "month 18+",
    why: "When your first portfolio has 12+ months of clean payment history, it qualifies for hypothecation. Approach lenders. Get an advance rate. Use the money to buy more tapes. This is when scaling actually starts.",
    href: "/app/portfolio",
    cta: "Open portfolio",
  },
  {
    id: "diversify",
    label: "Step 6 — Diversify",
    time: "year 2+",
    why: "Once you have $50k+/month in cash flow, expand: secured paper (auto, junior mortgages), tax liens, REOs, eventually your own SaaS arm or NPL fund. Tradeline's Capital page has the full menu.",
    href: "/app/capital",
    cta: "Open capital allocation",
  },
];

export function JourneyLadder() {
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

  const completed = STEPS.filter((s) => done[s.id]).length;
  const total = STEPS.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const currentStepIdx = STEPS.findIndex((s) => !done[s.id]);
  const currentStep = currentStepIdx >= 0 ? STEPS[currentStepIdx] : null;

  return (
    <>
      <p className="text-[15px] leading-relaxed text-[color:var(--color-fg)] mb-4">
        The order matters. Most people who try to skip steps wash out. Tick each
        step as you finish it — progress saves locally so this page is your
        journey ladder.
      </p>

      {hydrated && (
        <div
          className="mb-6 rounded-xl p-5"
          style={{
            background:
              "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            border: "1.5px solid transparent",
          }}
        >
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-accent)]">
                Where you are on the path
              </div>
              <p className="mt-1 text-[14px] text-[color:var(--color-fg-dim)]">
                {currentStep
                  ? `Next up: ${currentStep.label}`
                  : "All six steps complete. You're operating as a mature buyer."}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl text-[color:var(--color-accent)]">
                {completed}/{total}
              </div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                {pct}% through
              </div>
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full rounded-full bg-[color:var(--color-bg-2)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
            />
          </div>
          {currentStep && (
            <div className="mt-4">
              <Link
                href={currentStep.href}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#0a0c14] hover:opacity-90 transition inline-block"
                style={{ background: "var(--gradient-primary)" }}
              >
                {currentStep.cta} ⚡
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {STEPS.map((s) => {
          const checked = !!done[s.id];
          return (
            <div
              key={s.id}
              className={`rounded-lg border-l-2 pl-5 pr-5 py-4 transition ${
                checked
                  ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
                  : "border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)]"
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="mt-1 accent-[color:var(--color-accent)] shrink-0"
                />
                <div className="flex-1">
                  <div
                    className={`text-[15px] font-medium transition ${
                      checked
                        ? "text-[color:var(--color-fg-dim)] line-through"
                        : "text-[color:var(--color-fg)] group-hover:text-[color:var(--color-accent)]"
                    }`}
                  >
                    {s.label}
                  </div>
                  <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                    Typical timing: {s.time}
                  </div>
                  <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                    {s.why}
                  </p>
                  <div className="mt-3">
                    <Link
                      href={s.href}
                      className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition inline-block"
                    >
                      {s.cta} →
                    </Link>
                  </div>
                </div>
              </label>
            </div>
          );
        })}
      </div>
    </>
  );
}
