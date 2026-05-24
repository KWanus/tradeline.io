import "server-only";

/**
 * Persistent autopilot state. Lives as a JSON blob in the GitHub `data`
 * orphan branch (same place radar_snapshot.json lives) so it's readable
 * publicly by the cron + the UI, and writable via a single PAT-gated path.
 *
 * Why not Vercel KV / Postgres: this whole stack is currently single-user
 * (one operator) and we have a working data-branch pattern already. KV is
 * the right answer when we go multi-tenant; for now this keeps infra at $0.
 */

const STATE_PATH = "data/autopilot-state.json";
const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";
const GH_API = "https://api.github.com/repos/KWanus/tradeline.io/contents";

export type Audience = "sec" | "fdic" | "ncua";

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

/** Append a log entry to data/autopilot-log.json (one entry per send). */
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
};

const LOG_PATH = "data/autopilot-log.json";

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

export async function appendLog(
  entries: AutopilotLogEntry[]
): Promise<{ ok: boolean; reason?: string }> {
  if (entries.length === 0) return { ok: true };
  const pat = process.env.GITHUB_PAT;
  if (!pat) return { ok: false, reason: "GITHUB_PAT not set" };

  const existing = await readLog();
  // Keep last 500 entries so the file doesn't grow without bound.
  const merged = [...existing, ...entries].slice(-500);

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

  const contentB64 = Buffer.from(JSON.stringify(merged, null, 2), "utf-8").toString(
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
        message: `chore(autopilot): +${entries.length} log entries`,
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
