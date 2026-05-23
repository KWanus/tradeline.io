"use client";

/**
 * Daily-send budget guard. Cold-outreach domain reputation craters fast on
 * new domains — Gmail / Outlook score senders on a 0–100 scale and a fresh
 * domain that ships 100+ cold emails on day one is blacklisted within days.
 * Ceiling: 20 sends/day, ramping later via a profile setting.
 */

const KEY = "tradeline.daily_sends.v1";

export const DAILY_SEND_CAP = 20;

type DailyCount = { date: string; count: number };

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function read(): DailyCount {
  if (typeof window === "undefined") return { date: today(), count: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { date: today(), count: 0 };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.date === "string" && typeof parsed.count === "number") {
      if (parsed.date !== today()) return { date: today(), count: 0 };
      return parsed as DailyCount;
    }
    return { date: today(), count: 0 };
  } catch {
    return { date: today(), count: 0 };
  }
}

function write(v: DailyCount): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

export function getSentToday(): number {
  return read().count;
}

export function getRemainingToday(): number {
  return Math.max(0, DAILY_SEND_CAP - read().count);
}

export function recordSend(): number {
  const v = read();
  const next = { date: today(), count: v.count + 1 };
  write(next);
  return next.count;
}
