"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readDeals, type Deal } from "@/lib/pipeline";
import { readOutreach, type OutreachEvent } from "@/lib/bank-state";

const APPROVAL_STATE_KEY = "tradeline.approval_state.v2";
const DAILY_SENDS_KEY = "tradeline.daily_sends.v1";

type DailyCount = { date: string; count: number };
type ApprovalState = Record<string, "approved" | "skipped">;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function daysAgo(d: number): number {
  return Date.now() - d * 24 * 60 * 60 * 1000;
}

/**
 * Compact, sticky strip pinned beneath TopBar on every /app/* page.
 * Single visual answer to "where do I stand right now" — no extra clicks.
 * Reads from the same localStorage sources as /app/progress so numbers
 * match what the dashboard shows.
 */
export function ProgressStrip() {
  const [hydrated, setHydrated] = useState(false);
  const [sentToday, setSentToday] = useState(0);
  const [emailsThisWeek, setEmailsThisWeek] = useState(0);
  const [openDeals, setOpenDeals] = useState(0);
  const [outreachQueued, setOutreachQueued] = useState(0);

  const refresh = () => {
    if (typeof window === "undefined") return;
    const daily = read<DailyCount>(DAILY_SENDS_KEY, { date: today(), count: 0 });
    setSentToday(daily.date === today() ? daily.count : 0);

    const cutoff = daysAgo(7);
    const outreach = readOutreach() as OutreachEvent[];
    setEmailsThisWeek(
      outreach.filter((e) => new Date(e.sentAt).getTime() >= cutoff).length
    );

    const deals = readDeals() as Deal[];
    setOpenDeals(
      deals.filter(
        (d) => !["won", "lost", "walked", "sourced"].includes(d.stage)
      ).length
    );

    // Pending outreach count = approval state entries with "outreach-" prefix
    // that aren't yet approved/skipped. We can't directly inspect the
    // server-rendered proposals from here, but the approval_state map records
    // every decision keyed by proposal id, so we infer "queued" as: items
    // the user hasn't decided on yet. For the strip we just need a rough
    // signal of "is there work waiting" — we don't need exact counts.
    const state = read<ApprovalState>(APPROVAL_STATE_KEY, {});
    const decisionsToday = Object.keys(state).length;
    // Heuristic: assume ~9 daily outreach proposals (3 SEC + 3 FDIC + 3 NCUA).
    // If none are decided, all 9 are queued; if 9 are decided, 0 queued.
    setOutreachQueued(Math.max(0, 9 - decisionsToday));
  };

  useEffect(() => {
    refresh();
    setHydrated(true);
    const onChange = () => refresh();
    window.addEventListener("storage", onChange);
    window.addEventListener("tradeline.bank_state.changed", onChange);
    // Re-poll every 60s in case other tabs change state silently.
    const i = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("tradeline.bank_state.changed", onChange);
      clearInterval(i);
    };
  }, []);

  if (!hydrated) return <div className="h-9 border-b border-[color:var(--color-line)]" />;

  const allClear = sentToday === 0 && outreachQueued === 0 && openDeals === 0;

  return (
    <Link
      href="/app/progress"
      className="sticky top-0 z-20 block border-b border-[color:var(--color-line)] bg-[color:var(--color-bg)]/85 backdrop-blur-md hover:bg-[color:var(--color-bg-1)]/85 transition"
    >
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-2 text-[12px] font-mono">
        <div className="flex items-center gap-4 md:gap-6 overflow-x-auto no-scrollbar">
          <Cell
            label="Sent today"
            value={sentToday}
            tone={sentToday > 0 ? "accent" : "neutral"}
          />
          <Cell
            label="Queued"
            value={outreachQueued}
            tone={outreachQueued > 0 ? "warn" : "neutral"}
          />
          <Cell
            label="Week"
            value={emailsThisWeek}
            sub="emails"
            tone={emailsThisWeek >= 5 ? "accent" : "neutral"}
          />
          <Cell
            label="Open"
            value={openDeals}
            sub="deals"
            tone={openDeals > 0 ? "accent" : "neutral"}
          />
        </div>
        <span className="hidden md:inline text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] shrink-0">
          {allClear ? "All quiet · click for full report" : "Full report →"}
        </span>
      </div>
    </Link>
  );
}

function Cell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone: "accent" | "warn" | "neutral";
}) {
  const color =
    tone === "accent"
      ? "text-[color:var(--color-accent)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : "text-[color:var(--color-fg)]";
  return (
    <div className="flex items-baseline gap-1.5 shrink-0">
      <span className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </span>
      <span className={`text-[14px] tabular-nums ${color}`}>{value}</span>
      {sub && (
        <span className="text-[10px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          {sub}
        </span>
      )}
    </div>
  );
}
