"use client";

import { useEffect, useState } from "react";

const LAST_VISIT_KEY = "tradeline.last_visit.v1";
const DAILY_SENDS_KEY = "tradeline.daily_sends.v1";
const APPROVAL_STATE_KEY = "tradeline.approval_state.v2";

type DailyCount = { date: string; count: number };
type ApprovalState = Record<string, "approved" | "skipped">;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function relativeAge(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / (1000 * 60));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function WelcomeBack() {
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [sentLastSession, setSentLastSession] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = window.localStorage.getItem(LAST_VISIT_KEY);
    setLastVisit(prev);

    // Approximate "sent last session" = whatever was logged in daily_sends
    // (resets at midnight so this is "sent so far today including this session").
    const daily = read<DailyCount>(DAILY_SENDS_KEY, { date: "", count: 0 });
    setSentLastSession(daily.count);

    // Pending approvals = decisions taken so far. If user took action yesterday
    // but didn't finish the queue, this shows how many they touched (signal of
    // "you were working on this").
    const state = read<ApprovalState>(APPROVAL_STATE_KEY, {});
    setPendingApprovals(Object.keys(state).length);

    // Record this visit for next time.
    window.localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    setHydrated(true);
  }, []);

  if (!hydrated || dismissed) return null;
  if (!lastVisit) return null; // First-ever visit — first-run hero handles it
  const minsAgo = Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60));
  // Only show if it's been ≥ 1 hour since the last visit (otherwise just a refresh).
  if (minsAgo < 60) return null;

  const hadActivity = sentLastSession > 0 || pendingApprovals > 0;
  const headline = hadActivity
    ? `Welcome back. You sent ${sentLastSession} email${sentLastSession === 1 ? "" : "s"} and made ${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} last session.`
    : `Welcome back — last here ${relativeAge(lastVisit)}.`;
  const subline = hadActivity
    ? "Pick up where you left off below. Radar refreshes every 6 hours; today's queue may have grown."
    : "Today's queue is fresh. The radar refreshes every 6 hours overnight.";

  return (
    <div className="mb-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4 flex items-start justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Since last visit · {relativeAge(lastVisit)}
        </div>
        <h3 className="mt-1 text-[15px] text-[color:var(--color-fg)] leading-snug">
          {headline}
        </h3>
        <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {subline}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition px-2 py-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
