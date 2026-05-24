"use client";

/**
 * Tracks which inbox proposal IDs the operator has already seen, so the
 * inbox can badge cards that are new since the last visit.
 *
 * Flow: on each /app/today mount the inbox reads `readSeenIds()`, computes
 * `newIds = currentPendingIds \ seenIds`, renders a NEW badge for those,
 * then immediately calls `markSeen(currentPendingIds)` so they no longer
 * count as new next visit.
 *
 * Set is capped to a recent window — older entries roll off so the store
 * doesn't grow indefinitely from many days of refreshed proposals.
 */

const KEY = "tradeline.inbox_seen.v1";
const MAX_ENTRIES = 500;

type Stored = { ids: string[] };

export function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || !Array.isArray(parsed.ids)) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function writeSeenIds(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    // Keep the most recent MAX_ENTRIES — Set iteration is insertion-order in
    // every modern engine, so slicing from the tail keeps the freshest.
    const arr = Array.from(set);
    const trimmed =
      arr.length > MAX_ENTRIES ? arr.slice(-MAX_ENTRIES) : arr;
    window.localStorage.setItem(KEY, JSON.stringify({ ids: trimmed }));
  } catch {}
}

export function markSeen(ids: string[]): void {
  if (ids.length === 0) return;
  const seen = readSeenIds();
  for (const id of ids) seen.add(id);
  writeSeenIds(seen);
}
