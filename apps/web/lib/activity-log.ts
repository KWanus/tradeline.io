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
