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

export async function readReportLeads(): Promise<ReportLead[]> {
  let raw: string;
  try {
    raw = await fs.readFile(LEADS_PATH, "utf-8");
  } catch {
    return [];
  }
  const leads: ReportLead[] = [];
  const seen = new Set<string>();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as ReportLead;
      if (!parsed.email) continue;
      const email = parsed.email.toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      leads.push({ ...parsed, email });
    } catch {
      // Skip malformed lines
    }
  }
  // Most recent first
  leads.sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1));
  return leads;
}

export function summarizeLeadsByType(leads: ReportLead[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const l of leads) {
    const k = l.type || "other";
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
