import "server-only";

// Server-side opt-in backup for operator policy stores.
//
// Mirrors the existing `tape-inbox.ts` + `autopilot/state.ts` pattern:
// data lives on the orphan `data` branch of the public repo, read via
// raw.githubusercontent (no auth needed), written via the GitHub
// contents API with a PAT.
//
// Per the spine's privacy posture, server-side persistence is OPT-IN per
// store. localStorage remains the source of truth on each device; the
// operator explicitly clicks "Backup" or "Restore" to sync. No automatic
// background sync that would silently move PII to GitHub.
//
// V1 single-tenant — tenant key defaults to "default". Multi-tenant arrives
// when auth lands; the path scheme is already partitioned.

const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";
const GH_API = "https://api.github.com/repos/KWanus/tradeline.io/contents";

// Whitelist of known store names — caller can't sync arbitrary keys to
// the repo. Keeps the data branch tidy and prevents accidental PII writes.
export const SYNCABLE_STORES = [
  "returns",
  "compliance_licenses",
  "concentration_policy",
  "license_policy",
  "capital_config",
] as const;

export type SyncableStore = (typeof SYNCABLE_STORES)[number];

function pathFor(store: SyncableStore, tenant: string): string {
  // server-stores/{tenant}/{store}.json
  const safeTenant = tenant.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "default";
  return `server-stores/${safeTenant}/${store}.json`;
}

// ---------------------------------------------------------------------------
// Read (no auth)
// ---------------------------------------------------------------------------

export type ReadResult<T> =
  | { ok: true; data: T; etag?: string }
  | { ok: false; reason: string; status?: number };

export async function readStore<T = unknown>(
  store: SyncableStore,
  tenant = "default"
): Promise<ReadResult<T>> {
  const path = pathFor(store, tenant);
  try {
    const r = await fetch(`${RAW_BASE}/${path}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (r.status === 404) {
      return { ok: false, reason: "not_found", status: 404 };
    }
    if (!r.ok) {
      return { ok: false, reason: `read failed`, status: r.status };
    }
    const data = (await r.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Write (requires GITHUB_PAT)
// ---------------------------------------------------------------------------

export type WriteResult =
  | { ok: true; sha: string }
  | { ok: false; reason: string; status?: number };

async function getCurrentSha(path: string, pat: string): Promise<string | undefined> {
  try {
    const r = await fetch(`${GH_API}/${path}?ref=data`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return undefined;
    const meta = (await r.json()) as { sha?: string };
    return meta.sha;
  } catch {
    return undefined;
  }
}

export async function writeStore(
  store: SyncableStore,
  data: unknown,
  tenant = "default",
  commitMessage?: string
): Promise<WriteResult> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    return { ok: false, reason: "GITHUB_PAT not set on server", status: 503 };
  }
  const path = pathFor(store, tenant);
  const sha = await getCurrentSha(path, pat);
  const contentB64 = Buffer.from(JSON.stringify(data, null, 2), "utf-8").toString("base64");
  const message = commitMessage ?? `chore(server-store): sync ${store} for ${tenant}`;

  try {
    const put = await fetch(`${GH_API}/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: contentB64,
        branch: "data",
        sha,
      }),
    });
    if (!put.ok) {
      return {
        ok: false,
        reason: `GitHub ${put.status}: ${(await put.text()).slice(0, 200)}`,
        status: put.status,
      };
    }
    const resp = (await put.json()) as { content?: { sha?: string } };
    return { ok: true, sha: resp.content?.sha ?? "" };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
