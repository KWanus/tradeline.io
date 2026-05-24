"use client";

/**
 * Persistent cache of AI-personalized outreach drafts, keyed by proposal id.
 *
 * Auto-personalize-on-mount uses this so each card costs at most one
 * Anthropic API call ever — the cached subject/draft is used on every
 * subsequent render until the operator clicks "Re-personalize" to refresh.
 *
 * Trimmed to MAX_ENTRIES (oldest first) so the store doesn't grow
 * indefinitely from many days of refreshed inbox proposals.
 */

const KEY = "tradeline.personalized_drafts.v1";
const MAX_ENTRIES = 100;

export type CachedDraft = {
  subject: string;
  draft: string;
  cachedAt: number;
};

type Store = Record<string, CachedDraft>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Store)
      : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  const entries = Object.entries(store);
  let toWrite: Store = store;
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    toWrite = Object.fromEntries(entries.slice(-MAX_ENTRIES));
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(toWrite));
  } catch {}
}

export function readCachedDraft(cacheKey: string): CachedDraft | null {
  if (!cacheKey) return null;
  return readStore()[cacheKey] || null;
}

export function writeCachedDraft(
  cacheKey: string,
  subject: string,
  draft: string
): void {
  if (!cacheKey) return;
  const store = readStore();
  store[cacheKey] = { subject, draft, cachedAt: Date.now() };
  writeStore(store);
}
