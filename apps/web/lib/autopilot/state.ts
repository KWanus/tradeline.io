import "server-only";

import type { Audience } from "./audience";

export type { Audience } from "./audience";

/**
 * Persistent autopilot state. Lives as a JSON blob in the GitHub `data`
 * orphan branch (same place radar_snapshot.json lives) so it's readable
 * publicly by the cron + the UI, and writable via a single PAT-gated path.
 *
 * Why not Vercel KV / Postgres: this whole stack is currently single-user
 * (one operator) and we have a working data-branch pattern already. KV is
 * the right answer when we go multi-tenant; for now this keeps infra at $0.
 */

// Files live at the ROOT of the orphan `data` branch alongside
// radar_snapshot.json, not under a /data/ subdir.
const STATE_PATH = "autopilot-state.json";
const LOG_PATH = "autopilot-log.json";
const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";
const GH_API = "https://api.github.com/repos/KWanus/tradeline.io/contents";

export type AutopilotState = {
  /** Master toggle. False = cron does nothing even if scheduled. */
  enabled: boolean;
  /** When true the runner composes + logs but does NOT send. Safe-default
   * for the first 3 days of new setups so the operator can audit drafts. */
  dryRun: boolean;
  /** Max emails per cron run. Ramps from 5 → 20 over warm-up. */
  dailyCap: number;
  /** Which queues to pull from. */
  audiences: Audience[];
  /** Optional custom outreach template (Option B). When null, runner uses
   * the snapshot's per-bank generated drafts. */
  customTemplate: string | null;
  /** When set, cron skips runs and surfaces the reason in the UI. */
  pausedReason: string | null;
  /** ISO timestamp; updated by /app/today on visit. If older than 7 days
   * the runner pauses itself ("operator hasn't checked in"). */
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_STATE: AutopilotState = {
  enabled: false,
  dryRun: true,
  dailyCap: 5,
  audiences: ["sec", "fdic", "ncua"],
  customTemplate: null,
  pausedReason: null,
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Fetch state from the raw GitHub URL. Returns DEFAULT_STATE if missing. */
export async function readState(): Promise<AutopilotState> {
  try {
    const r = await fetch(`${RAW_BASE}/${STATE_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return { ...DEFAULT_STATE };
    const parsed = (await r.json()) as Partial<AutopilotState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Write the state file via the GitHub Contents API. Requires GITHUB_PAT
 * with `contents:write` scope on this repo. Commits to the `data` branch.
 */
export async function writeState(
  updates: Partial<AutopilotState>
): Promise<{ ok: boolean; reason?: string }> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    return { ok: false, reason: "GITHUB_PAT not set" };
  }

  const current = await readState();
  const next: AutopilotState = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Get current SHA of the file (required to update, omit if creating).
  let sha: string | undefined;
  try {
    const shaRes = await fetch(`${GH_API}/${STATE_PATH}?ref=data`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (shaRes.ok) {
      const meta = (await shaRes.json()) as { sha?: string };
      sha = meta.sha;
    }
  } catch {}

  const contentB64 = Buffer.from(JSON.stringify(next, null, 2), "utf-8").toString(
    "base64"
  );

  try {
    const put = await fetch(`${GH_API}/${STATE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "chore(autopilot): update state",
        content: contentB64,
        branch: "data",
        sha,
      }),
    });
    if (!put.ok) {
      return {
        ok: false,
        reason: `GitHub ${put.status}: ${(await put.text()).slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** One log entry per autopilot send attempt. */
export type AutopilotLogEntry = {
  ts: string;
  bankKey: string;
  bankName: string;
  audience: Audience;
  recipient?: string;
  subject?: string;
  status: "sent" | "skipped-no-contact" | "skipped-cap" | "failed" | "dry-run";
  providerMessageId?: string;
  error?: string;
  /** Outcome label applied after the send. Powers pattern-performance
   * ranking — never required at write time; back-filled by /api/outcome
   * (operator-tagged) or by the auto-no-reply rule at read time. */
  outcome?: Outcome;
  outcomeAt?: string;
  /** Source of the log entry. "cron" = autopilot batch run; "manual" =
   * operator clicked Send in the inbox. Useful for slicing pattern
   * performance later (cron sends may have different conversion than
   * one-off operator sends). */
  source?: "cron" | "manual";
  /** Two-letter state code of the originator. Captured at send time so
   * pattern-performance can compute per-state reply rates without
   * re-joining against a possibly-mutated snapshot. */
  state?: string;
};

export type Outcome = "replied" | "no_reply" | "won_deal" | "lost_deal";

export async function readLog(): Promise<AutopilotLogEntry[]> {
  try {
    const r = await fetch(`${RAW_BASE}/${LOG_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const parsed = (await r.json()) as unknown;
    return Array.isArray(parsed) ? (parsed as AutopilotLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** Internal: PUT the log file contents to the data branch. Shared by
 * appendLog and appendOutcome since both rewrite the whole file. */
async function writeLog(
  pat: string,
  entries: AutopilotLogEntry[],
  commitMessage: string
): Promise<{ ok: boolean; reason?: string }> {
  let sha: string | undefined;
  try {
    const shaRes = await fetch(`${GH_API}/${LOG_PATH}?ref=data`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (shaRes.ok) {
      const meta = (await shaRes.json()) as { sha?: string };
      sha = meta.sha;
    }
  } catch {}

  const contentB64 = Buffer.from(JSON.stringify(entries, null, 2), "utf-8").toString(
    "base64"
  );

  try {
    const put = await fetch(`${GH_API}/${LOG_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: commitMessage,
        content: contentB64,
        branch: "data",
        sha,
      }),
    });
    if (!put.ok) {
      return {
        ok: false,
        reason: `GitHub ${put.status}: ${(await put.text()).slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function appendLog(
  entries: AutopilotLogEntry[]
): Promise<{ ok: boolean; reason?: string }> {
  if (entries.length === 0) return { ok: true };
  const pat = process.env.GITHUB_PAT;
  if (!pat) return { ok: false, reason: "GITHUB_PAT not set" };

  const existing = await readLog();
  // Keep last 500 entries so the file doesn't grow without bound.
  const merged = [...existing, ...entries].slice(-500);

  return writeLog(pat, merged, `chore(autopilot): +${entries.length} log entries`);
}

/**
 * Tag the most-recent matching sent entry with an outcome. Walks the log
 * from newest to oldest looking for a `status === "sent"` row with the
 * given bankKey — that's the most recent send the operator could be
 * labeling. Returns `updated: false` (still `ok: true`) when no matching
 * entry exists, so callers can show a soft notice instead of an error.
 *
 * Idempotent: relabeling overwrites the prior outcome + timestamp.
 */
export async function appendOutcome(
  bankKey: string,
  outcome: Outcome
): Promise<{ ok: boolean; updated: boolean; reason?: string }> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return { ok: false, updated: false, reason: "GITHUB_PAT not set" };

  const log = await readLog();
  let matchedIndex = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].bankKey === bankKey && log[i].status === "sent") {
      matchedIndex = i;
      break;
    }
  }
  if (matchedIndex === -1) {
    return { ok: true, updated: false, reason: "no matching sent entry" };
  }

  const next = [...log];
  next[matchedIndex] = {
    ...next[matchedIndex],
    outcome,
    outcomeAt: new Date().toISOString(),
  };

  const res = await writeLog(
    pat,
    next,
    `chore(autopilot): outcome=${outcome} for ${bankKey}`
  );
  return { ...res, updated: res.ok };
}
