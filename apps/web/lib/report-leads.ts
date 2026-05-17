import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

export type ReportLead = {
  email: string;
  name?: string;
  type?: string;
  source?: string;
  submittedAt: string;
};

const LEADS_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "data",
  "output",
  "report_leads.jsonl"
);

const UNSUB_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "data",
  "output",
  "report_unsubscribes.jsonl"
);

type UnsubEvent = { email: string; unsubscribedAt: string; reason?: string };

async function readJsonlFile<T>(p: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await fs.readFile(p, "utf-8");
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // Skip malformed lines
    }
  }
  return out;
}

export async function readUnsubscribed(): Promise<Set<string>> {
  const rows = await readJsonlFile<UnsubEvent>(UNSUB_PATH);
  const set = new Set<string>();
  for (const r of rows) {
    if (r.email) set.add(r.email.trim().toLowerCase());
  }
  return set;
}

export async function appendUnsubscribe(
  email: string,
  reason?: string
): Promise<void> {
  const record: UnsubEvent = {
    email: email.trim().toLowerCase(),
    unsubscribedAt: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };
  await fs.mkdir(path.dirname(UNSUB_PATH), { recursive: true });
  await fs.appendFile(UNSUB_PATH, JSON.stringify(record) + "\n", "utf-8");
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  const set = await readUnsubscribed();
  return set.has(email.trim().toLowerCase());
}

export async function readReportLeads(): Promise<ReportLead[]> {
  const rows = await readJsonlFile<ReportLead>(LEADS_PATH);
  const unsub = await readUnsubscribed();
  const seen = new Set<string>();
  const leads: ReportLead[] = [];
  for (const r of rows) {
    if (!r.email) continue;
    const email = r.email.toLowerCase();
    if (seen.has(email)) continue;
    if (unsub.has(email)) continue;
    seen.add(email);
    leads.push({ ...r, email });
  }
  // Most recent first
  leads.sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1));
  return leads;
}

export async function readAllLeadsIncludingUnsub(): Promise<{
  leads: ReportLead[];
  unsubscribed: number;
}> {
  const rows = await readJsonlFile<ReportLead>(LEADS_PATH);
  const unsub = await readUnsubscribed();
  const seen = new Set<string>();
  const leads: ReportLead[] = [];
  for (const r of rows) {
    if (!r.email) continue;
    const email = r.email.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    leads.push({ ...r, email });
  }
  return { leads, unsubscribed: unsub.size };
}

export function summarizeLeadsByType(leads: ReportLead[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const l of leads) {
    const k = l.type || "other";
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
