"use client";

import { useEffect, useState } from "react";

// Outreach log — records every time the user copies an outreach email for a bank,
// per-broker. Drives the "no reply after 7d / 14d" outcomes so they can highlight
// automatically based on elapsed time.

export type OutreachEvent = {
  ticker: string;
  brokerShortName: string;
  brokerName: string;
  sentAt: string; // ISO
};

const OUTREACH_KEY = "tradeline.bank_outreach_log.v1";
const WATCHLIST_KEY = "tradeline.bank_watchlist.v1";
const EVENT = "tradeline.bank_state.changed";

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emit();
  } catch {}
}

// --- Outreach log ---

export function readOutreach(): OutreachEvent[] {
  return readArray<OutreachEvent>(OUTREACH_KEY);
}

export function logOutreach(e: OutreachEvent): void {
  const events = readOutreach();
  events.push(e);
  writeArray(OUTREACH_KEY, events);
}

export function outreachForTicker(ticker: string): OutreachEvent[] {
  return readOutreach().filter((e) => e.ticker === ticker);
}

export function daysSinceOutreach(ticker: string, brokerShortName?: string): number | null {
  const events = readOutreach().filter(
    (e) => e.ticker === ticker && (!brokerShortName || e.brokerShortName === brokerShortName)
  );
  if (events.length === 0) return null;
  const latest = events.reduce((a, b) => (a.sentAt > b.sentAt ? a : b));
  const ms = Date.now() - new Date(latest.sentAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function useOutreachForTicker(ticker: string): OutreachEvent[] {
  const [events, setEvents] = useState<OutreachEvent[]>([]);
  useEffect(() => {
    setEvents(outreachForTicker(ticker));
    const onChange = () => setEvents(outreachForTicker(ticker));
    const onStorage = (e: StorageEvent) => {
      if (e.key === OUTREACH_KEY) setEvents(outreachForTicker(ticker));
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [ticker]);
  return events;
}

// --- Watchlist ---

export function readWatchlist(): string[] {
  return readArray<string>(WATCHLIST_KEY);
}

export function isWatchlisted(ticker: string): boolean {
  return readWatchlist().includes(ticker);
}

export function toggleWatchlist(ticker: string): void {
  const list = readWatchlist();
  const idx = list.indexOf(ticker);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(ticker);
  writeArray(WATCHLIST_KEY, list);
}

export function useWatchlist(): [string[], (ticker: string) => void] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    setList(readWatchlist());
    const onChange = () => setList(readWatchlist());
    const onStorage = (e: StorageEvent) => {
      if (e.key === WATCHLIST_KEY) setList(readWatchlist());
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return [list, toggleWatchlist];
}

export function useIsWatchlisted(ticker: string): [boolean, () => void] {
  const [list, toggle] = useWatchlist();
  const flagged = list.includes(ticker);
  return [flagged, () => toggle(ticker)];
}
