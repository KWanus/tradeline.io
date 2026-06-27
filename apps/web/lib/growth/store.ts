import "server-only";

/**
 * Growth Engine store — the SALES-side outreach nervous system.
 *
 * Distinct from `lib/autopilot/*`, which automates outreach a debt buyer
 * sends to BANKS to source deals (a product feature). This module automates
 * outreach that sells Tradeline ITSELF to the people who would pay for it:
 * debt buyers, receivables brokers, collection agencies, debt-settlement
 * firms, creditors-rights law firms, and distressed-credit funds.
 *
 * Same persistence pattern as autopilot state: one JSON blob on the GitHub
 * `data` orphan branch (publicly readable by the UI + cron, PAT-gated write).
 * Keeps infra at $0 while the stack is single-operator. Move to KV when
 * multi-tenant.
 */

const QUEUE_PATH = "growth-queue.json";
const RAW_BASE = "https://raw.githubusercontent.com/KWanus/tradeline.io/data";
const GH_API = "https://api.github.com/repos/KWanus/tradeline.io/contents";

/** Who we sell Tradeline to. Each maps to a different pitch angle. */
export type GrowthSegment =
  | "debt-buyer"
  | "broker"
  | "collection-agency"
  | "debt-settlement"
  | "law-firm"
  | "fund"
  | "other";

export const SEGMENT_LABELS: Record<GrowthSegment, string> = {
  "debt-buyer": "Debt buyer / NPL fund",
  broker: "Receivables / debt broker",
  "collection-agency": "Collection agency",
  "debt-settlement": "Debt-settlement firm",
  "law-firm": "Creditors-rights law firm",
  fund: "Distressed-credit fund / family office",
  other: "Adjacent business",
};

export type GrowthLeadStatus =
  | "pending" // discovered + drafted, awaiting operator approval
  | "approved" // operator approved; about to send / sending
  | "sent" // shipped via Resend
  | "skipped" // operator passed
  | "failed"; // send attempt failed

export type GrowthLead = {
  /** Stable id — hash of normalized firm+email. Dedupes across runs. */
  id: string;
  firm: string;
  segment: GrowthSegment;
  contactName: string | null;
  /** Public BUSINESS email only (info@/sales@/named role on a company site). */
  email: string;
  website: string | null;
  /** Public URL where the email was found — kept for auditability. */
  sourceUrl: string | null;
  /** One sentence: why this firm would pay for Tradeline. */
  rationale: string;
  /** Drafted outreach. */
  subject: string;
  body: string;
  status: GrowthLeadStatus;
  discoveredAt: string;
  sentAt: string | null;
  providerMessageId: string | null;
  error: string | null;
};

export type GrowthConfig = {
  /** Master toggle. False = discovery cron does nothing. */
  enabled: boolean;
  /**
   * When false (default), the cron discovers + drafts + queues, and the
   * operator taps Approve to send. When true, the cron also SENDS up to
   * `dailyCap` approved leads automatically — full hands-off. Off by default
   * because cold sales email is outward-facing and irreversible.
   */
  autoApprove: boolean;
  /** How many fresh prospects to find per discovery run. */
  dailyDiscoverTarget: number;
  /** Max emails actually shipped per run (whether auto or after approval). */
  dailyCap: number;
  /** Which buyer segments to hunt for. */
  segments: GrowthSegment[];
  /** Geographic focus, free text fed to the searcher (e.g. "United States"). */
  geo: string;
  pausedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GrowthStore = {
  config: GrowthConfig;
  leads: GrowthLead[];
};

export const DEFAULT_CONFIG: GrowthConfig = {
  enabled: false,
  autoApprove: false,
  dailyDiscoverTarget: 10,
  dailyCap: 20,
  segments: ["debt-buyer", "broker", "collection-agency", "fund"],
  geo: "United States",
  pausedReason: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const EMPTY_STORE: GrowthStore = { config: { ...DEFAULT_CONFIG }, leads: [] };

/** Keep the queue bounded — the data branch is a JSON blob, not a DB. */
const MAX_LEADS = 500;

/** Stable id from firm + email (no Date.now / random so reruns dedupe). */
export function leadId(firm: string, email: string): string {
  const norm = `${firm.trim().toLowerCase()}|${email.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < norm.length; i++) {
    h = (h * 33) ^ norm.charCodeAt(i);
  }
  return `g_${(h >>> 0).toString(36)}`;
}

/** Fetch the whole store from the raw GitHub URL. Never throws. */
export async function readGrowth(): Promise<GrowthStore> {
  try {
    const r = await fetch(`${RAW_BASE}/${QUEUE_PATH}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return { config: { ...DEFAULT_CONFIG }, leads: [] };
    const parsed = (await r.json()) as Partial<GrowthStore>;
    return {
      config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
    };
  } catch {
    return { config: { ...DEFAULT_CONFIG }, leads: [] };
  }
}

/** Low-level whole-file write via the GitHub Contents API (PAT-gated). */
async function writeGrowth(
  store: GrowthStore
): Promise<{ ok: boolean; reason?: string }> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return { ok: false, reason: "GITHUB_PAT not set" };

  // Trim to the most recent MAX_LEADS by discovery time so the blob stays small.
  const leads = [...store.leads]
    .sort((a, b) => (a.discoveredAt < b.discoveredAt ? 1 : -1))
    .slice(0, MAX_LEADS);
  const next: GrowthStore = { config: store.config, leads };

  let sha: string | undefined;
  try {
    const shaRes = await fetch(`${GH_API}/${QUEUE_PATH}?ref=data`, {
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

  const contentB64 = Buffer.from(
    JSON.stringify(next, null, 2),
    "utf-8"
  ).toString("base64");

  try {
    const put = await fetch(`${GH_API}/${QUEUE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "chore(growth): update queue",
        content: contentB64,
        branch: "data",
        ...(sha ? { sha } : {}),
      }),
    });
    if (!put.ok) {
      return { ok: false, reason: `GitHub ${put.status}: ${(await put.text()).slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Persist config (merged). */
export async function writeConfig(
  updates: Partial<GrowthConfig>
): Promise<{ ok: boolean; reason?: string }> {
  const store = await readGrowth();
  store.config = {
    ...store.config,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return writeGrowth(store);
}

/**
 * Insert freshly discovered leads, skipping any whose id already exists
 * (so reruns never duplicate a firm). Returns the count actually added.
 */
export async function upsertLeads(
  incoming: GrowthLead[]
): Promise<{ ok: boolean; added: number; reason?: string }> {
  const store = await readGrowth();
  const have = new Set(store.leads.map((l) => l.id));
  const fresh = incoming.filter((l) => !have.has(l.id));
  if (fresh.length === 0) return { ok: true, added: 0 };
  store.leads = [...fresh, ...store.leads];
  const res = await writeGrowth(store);
  return { ok: res.ok, added: res.ok ? fresh.length : 0, reason: res.reason };
}

/** Patch a single lead by id. */
export async function updateLead(
  id: string,
  patch: Partial<GrowthLead>
): Promise<{ ok: boolean; lead?: GrowthLead; reason?: string }> {
  const store = await readGrowth();
  const idx = store.leads.findIndex((l) => l.id === id);
  if (idx < 0) return { ok: false, reason: "lead not found" };
  store.leads[idx] = { ...store.leads[idx], ...patch, id };
  const res = await writeGrowth(store);
  return { ok: res.ok, lead: store.leads[idx], reason: res.reason };
}
