"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  ACTIVITY_STORAGE_KEY,
  readActivityLog,
  type ActivityEntry,
} from "@/lib/activity-log";

function relativeTime(iso: string, now: Date): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const sec = Math.max(0, Math.floor((now.getTime() - ts) / 1000));
  if (sec < 60) return "moments ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/**
 * Top-bar notification bell. Surfaces the operator's most recent cross-pillar
 * actions (from the activity log in localStorage) with a click-out dropdown
 * and an unseen counter. "Seen" is tracked by the timestamp of the newest
 * entry the operator has already opened the tray on, so the badge clears once
 * they look.
 */

const SEEN_KEY = "tradeline.notifications_seen_ts.v1";

export function NotificationBell() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [seenTs, setSeenTs] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  const refresh = () => {
    setEntries(readActivityLog().slice(0, 12));
  };

  useEffect(() => {
    refresh();
    try {
      setSeenTs(window.localStorage.getItem(SEEN_KEY) || "");
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const unseen = entries.filter((e) => !seenTs || e.ts > seenTs).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      refresh();
      const newest = entries[0]?.ts;
      if (newest) {
        setSeenTs(newest);
        try {
          window.localStorage.setItem(SEEN_KEY, newest);
        } catch {}
      }
    }
  };

  const now = new Date();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
      >
        <span aria-hidden>◌</span>
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-accent)] px-1 text-[10px] font-semibold text-[#0a0c14]">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[88vw] rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-line)]">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[color:var(--color-fg-faint)]">
              Recent activity
            </span>
            <Link
              href="/app/progress"
              onClick={() => setOpen(false)}
              className="font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-accent)] hover:underline"
            >
              All →
            </Link>
          </div>
          {entries.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-[color:var(--color-fg-dim)]">
              No activity yet. Sends, deals, and decisions show up here.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-[color:var(--color-line)]">
              {entries.map((e) => {
                const inner = (
                  <div className="px-4 py-3 hover:bg-[color:var(--color-bg-2)] transition">
                    <div className="text-[13px] text-[color:var(--color-fg)] leading-snug">
                      {e.summary}
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-fg-faint)]">
                      <span>{e.pillar}</span>
                      <span>·</span>
                      <span>{relativeTime(e.ts, now)}</span>
                    </div>
                  </div>
                );
                return (
                  <li key={e.id}>
                    {e.deepLink ? (
                      <Link href={e.deepLink} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
