"use client";

// Activity log — operator's recent actions across all pillars, persisted
// in browser localStorage as a ring buffer. Surfaces in the AI context
// so briefing + tutor can reference "you decoded a CA-heavy tape 2h
// ago" or "you just bumped a deal to bidding" — temporal awareness
// the static state stores can't provide.
//
// Storage: tradeline.activity-log.v1, capped at MAX_ENTRIES with FIFO
// eviction so the file stays small (~50KB worst case at cap).

export const ACTIVITY_STORAGE_KEY = "tradeline.activity-log.v1";
export const MAX_ENTRIES = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType =
  | "tape_decoded"
  | "license_configured"
  | "capital_configured"
  | "concentration_configured"
  | "return_flagged"
  | "return_status_changed"
  | "deal_converted_to_holding"
  | "rule_acknowledged"
  | "os_setup_completed";

export type Pillar =
  | "tape"
  | "compliance"
  | "capital"
  | "returns"
  | "portfolio"
  | "pipeline";

export type ActivityEntry = {
  id: string;
  ts: string; // ISO timestamp
  type: ActionType;
  pillar: Pillar;
  summary: string; // 1-line human-readable
  deepLink?: string; // optional /app/* URL the operator can click to return
  // Lightweight metadata for analytics — kept small + non-PII
  meta?: Record<string, string | number | boolean>;
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function newId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function readActivityLog(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

function writeActivityLog(entries: ActivityEntry[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

// Log one action. Newest first. Caps via FIFO so storage stays bounded.
export function logAction(input: {
  type: ActionType;
  pillar: Pillar;
  summary: string;
  deepLink?: string;
  meta?: Record<string, string | number | boolean>;
}): ActivityEntry | null {
  if (typeof window === "undefined") return null;
  const entry: ActivityEntry = {
    id: newId(),
    ts: new Date().toISOString(),
    type: input.type,
    pillar: input.pillar,
    summary: input.summary,
    deepLink: input.deepLink,
    meta: input.meta,
  };
  const existing = readActivityLog();
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  writeActivityLog(next);
  return entry;
}

export function clearActivityLog(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// AI-context summarizer
//
// Produces a "## Recent activity (last N)" markdown block for inclusion
// in the AI userContext so briefing + tutor + future surfaces can
// reference what the operator just did. Date-relative format keeps the
// text compact.
// ---------------------------------------------------------------------------

function relativeTime(iso: string, now: Date = new Date()): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "(unknown time)";
  const diffMs = now.getTime() - ts;
  if (diffMs < 0) return "(just now)";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "moments ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

// ---------------------------------------------------------------------------
// Recent tape decodes — derived view for the Tape Copilot "Recent decodes"
// picker. Filters tape_decoded entries with their meta intact so the UI
// doesn't need its own store.
// ---------------------------------------------------------------------------

export type RecentTapeDecode = {
  id: string;
  ts: string;
  filename: string; // recovered from summary or "—"
  rowCount: number;
  totalFaceValueUsd: number;
  assetClass: string;
  topState: string;
  schemaGrade: string;
};

export function recentTapeDecodes(limit = 10): RecentTapeDecode[] {
  if (typeof window === "undefined") return [];
  const log = readActivityLog();
  const out: RecentTapeDecode[] = [];
  for (const e of log) {
    if (e.type !== "tape_decoded") continue;
    const meta = e.meta ?? {};
    // Summary format from uploader processText:
    //   "Decoded <source>: <headline>"
    const m = /^Decoded (.+?):/.exec(e.summary);
    const filename = m?.[1] ?? "—";
    out.push({
      id: e.id,
      ts: e.ts,
      filename,
      rowCount: Number(meta.rowCount) || 0,
      totalFaceValueUsd: Number(meta.totalFaceValueUsd) || 0,
      assetClass: String(meta.assetClass ?? ""),
      topState: String(meta.topState ?? ""),
      schemaGrade: String(meta.schemaGrade ?? ""),
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dynamic tutor prompts — heuristic-derived starter questions for /app/tutor
// based on recent activity + spine state. Pure function, no LLM call. The
// tutor surfaces these as buttons next to the static SUGGESTED_QUESTIONS
// so the operator can dive into "what does my recent activity mean"
// without typing.
// ---------------------------------------------------------------------------

import type { License } from "./compliance-licenses";

const DAY_MS = 86_400_000;

export function buildDynamicTutorPrompts(input: {
  // Pre-computed spine snippets so this function stays pure / testable.
  // Caller passes nulls when nothing is configured.
  activeLicenses: License[];
  urgentReturnsCount: number;
  capitalOverCommitted: boolean;
  // Days the operator wants to look back for tape decode patterns.
  windowDays?: number;
  // Override for testability — defaults to readActivityLog().
  recentActivity?: ActivityEntry[];
}): string[] {
  const log = input.recentActivity ?? readActivityLog();
  const window = input.windowDays ?? 14;
  const cutoff = Date.now() - window * DAY_MS;
  const prompts: string[] = [];

  // 1. Recent decode patterns
  const recentDecodes = log.filter(
    (e) => e.type === "tape_decoded" && new Date(e.ts).getTime() >= cutoff
  );
  if (recentDecodes.length >= 2) {
    // Group by asset class to spot comparisons worth surfacing
    const byClass = new Map<string, number>();
    for (const d of recentDecodes) {
      const cls = String(d.meta?.assetClass ?? "");
      if (cls) byClass.set(cls, (byClass.get(cls) ?? 0) + 1);
    }
    const dominant = Array.from(byClass.entries()).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] >= 2) {
      prompts.push(
        `Compare the ${dominant[1]} ${dominant[0]} tapes I decoded in the last ${window} days — which one is the best buy?`
      );
    } else {
      prompts.push(
        `I've decoded ${recentDecodes.length} tapes in the last ${window} days — walk me through which one to bid first.`
      );
    }
  } else if (recentDecodes.length === 1) {
    const d = recentDecodes[0];
    const cls = String(d.meta?.assetClass ?? "");
    const state = String(d.meta?.topState ?? "");
    prompts.push(
      `What's the next step on the ${state ? `${state} ` : ""}${cls || "tape"} I decoded ${relativeShort(d.ts)} ago?`
    );
  }

  // 2. Reg F failures on recent decodes → coaching prompt
  const regFFails = recentDecodes.filter((d) => String(d.meta?.schemaGrade ?? "") === "F");
  if (regFFails.length > 0) {
    prompts.push(
      `One of my recent tapes failed the Reg F minimum check — what do I demand from the seller to make it usable?`
    );
  }

  // 3. Urgent returns
  if (input.urgentReturnsCount > 0) {
    prompts.push(
      `Help me draft a return notice for the ${input.urgentReturnsCount} flagged account${input.urgentReturnsCount === 1 ? "" : "s"} on my book.`
    );
  }

  // 4. License expiry inside 60d
  const renewSoon = input.activeLicenses
    .map((l) => ({ l, days: daysUntilIso(l.expirationDate) }))
    .filter((x) => x.days >= 0 && x.days <= 60)
    .sort((a, b) => a.days - b.days)[0];
  if (renewSoon) {
    prompts.push(
      `What's the renewal process for my ${renewSoon.l.state} ${renewSoon.l.licenseType} license (expires in ${renewSoon.days}d)?`
    );
  }

  // 5. Capital over-commit
  if (input.capitalOverCommitted) {
    prompts.push(
      `I'm over-committed on capital — walk me through the cleanest way to right-size without dropping a winning bid.`
    );
  }

  // 6. Newly converted holdings
  const recentConversions = log.filter(
    (e) =>
      e.type === "deal_converted_to_holding" &&
      new Date(e.ts).getTime() >= cutoff
  );
  if (recentConversions.length > 0 && prompts.length < 4) {
    prompts.push(
      `What should I track in the first 30 days for the ${recentConversions.length} holding${recentConversions.length === 1 ? "" : "s"} I just converted?`
    );
  }

  // Cap at 4 — tutor UI doesn't need more
  return prompts.slice(0, 4);
}

function daysUntilIso(iso: string): number {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return Infinity;
  return Math.floor((ts - Date.now()) / DAY_MS);
}

function relativeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

// ---------------------------------------------------------------------------
// Activity-driven license recommendations — when an operator decodes tapes
// with significant face in states they're not licensed in, surface those
// states as "consider licensing" recommendations on /app/compliance.
// Personalized counterpart to the static LicenseGapPanel (which only shows
// generic state buckets).
// ---------------------------------------------------------------------------

export type RecommendedLicense = {
  state: string;
  decodeCount: number;
  totalFaceUsd: number;
  // Most-recent decode timestamp (ISO) — useful for sort tie-break
  mostRecentDecode: string;
};

export function recommendLicensesFromDecodes(input: {
  licensedStates: string[]; // 2-letter codes
  windowDays?: number; // default 90
  minFaceUsd?: number; // skip states below this threshold; default 100k
  limit?: number; // default 10
}): RecommendedLicense[] {
  if (typeof window === "undefined") return [];
  const window_ = input.windowDays ?? 90;
  const minFace = input.minFaceUsd ?? 100_000;
  const limit = input.limit ?? 10;
  const cutoff = Date.now() - window_ * DAY_MS;
  const licensed = new Set(input.licensedStates.map((s) => s.toUpperCase()));

  const acc = new Map<
    string,
    { count: number; face: number; mostRecent: string }
  >();
  const log = readActivityLog();
  for (const e of log) {
    if (e.type !== "tape_decoded") continue;
    if (new Date(e.ts).getTime() < cutoff) continue;
    const state = String(e.meta?.topState ?? "").toUpperCase();
    if (!state || state.length !== 2) continue;
    if (licensed.has(state)) continue;
    const face = Number(e.meta?.totalFaceValueUsd) || 0;
    const cur = acc.get(state) ?? { count: 0, face: 0, mostRecent: e.ts };
    cur.count++;
    cur.face += face;
    if (e.ts > cur.mostRecent) cur.mostRecent = e.ts;
    acc.set(state, cur);
  }

  const out: RecommendedLicense[] = [];
  for (const [state, v] of acc) {
    if (v.face < minFace) continue;
    out.push({
      state,
      decodeCount: v.count,
      totalFaceUsd: v.face,
      mostRecentDecode: v.mostRecent,
    });
  }
  // Sort by total face descending
  out.sort((a, b) => b.totalFaceUsd - a.totalFaceUsd);
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Per-pillar event counts per day — for spine-badge sparklines and any
// future "trend" surfaces. Returns N daily buckets (most recent last)
// per pillar.
// ---------------------------------------------------------------------------

export type PillarDailyCounts = {
  pillar: Pillar;
  buckets: number[]; // length = days, oldest at index 0, newest at end
};

export function eventCountsByPillarPerDay(days = 7, now: Date = new Date()): PillarDailyCounts[] {
  if (typeof window === "undefined") return [];
  const log = readActivityLog();
  const pillars: Pillar[] = ["tape", "compliance", "capital", "returns", "portfolio", "pipeline"];

  // Compute day-start timestamps (UTC) for the requested window
  const dayMs = 86_400_000;
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).getTime();
  const bucketStarts: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    bucketStarts.push(todayStart - i * dayMs);
  }

  const out: PillarDailyCounts[] = pillars.map((p) => ({
    pillar: p,
    buckets: new Array(days).fill(0),
  }));
  const indexByPillar = new Map<Pillar, number>(out.map((o, i) => [o.pillar, i]));

  for (const e of log) {
    const ts = new Date(e.ts).getTime();
    if (Number.isNaN(ts)) continue;
    // Find which bucket (if any) this event falls into
    const lastBucketEnd = todayStart + dayMs;
    if (ts < bucketStarts[0] || ts >= lastBucketEnd) continue;
    const bucketIdx = Math.min(days - 1, Math.max(0, Math.floor((ts - bucketStarts[0]) / dayMs)));
    const pillarIdx = indexByPillar.get(e.pillar);
    if (pillarIdx === undefined) continue;
    out[pillarIdx].buckets[bucketIdx]++;
  }
  return out;
}

export function formatActivityForAi(limit = 15): string {
  if (typeof window === "undefined") return "";
  const log = readActivityLog().slice(0, limit);
  if (log.length === 0) return "";
  const lines = log.map((e) => {
    const when = relativeTime(e.ts);
    const link = e.deepLink ? ` (${e.deepLink})` : "";
    return `- [${when}] ${e.summary}${link}`;
  });
  return `## Recent activity (last ${log.length} actions)\n${lines.join("\n")}`;
}
