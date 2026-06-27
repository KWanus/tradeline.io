import "server-only";

import { readInbox } from "@/lib/replies";

import { readGrowth } from "./store";

/**
 * Funnel rollup across the whole growth nervous system, for the command-center
 * strip on /app/growth. Stages: discovered → contacted → replied → converted,
 * plus a count of inbound voice leads. Cheap (two JSON reads on the data branch).
 */
export type GrowthFunnel = {
  discovered: number;
  contacted: number;
  replied: number;
  converted: number;
  voiceLeads: number;
  /** contacted / discovered, 0..1. */
  contactRate: number;
  /** replied / contacted, 0..1. */
  replyRate: number;
  /** converted / contacted, 0..1. */
  conversionRate: number;
};

const EMPTY: GrowthFunnel = {
  discovered: 0,
  contacted: 0,
  replied: 0,
  converted: 0,
  voiceLeads: 0,
  contactRate: 0,
  replyRate: 0,
  conversionRate: 0,
};

export async function computeGrowthFunnel(): Promise<GrowthFunnel> {
  let store: Awaited<ReturnType<typeof readGrowth>>;
  let inbox: Awaited<ReturnType<typeof readInbox>>;
  try {
    [store, inbox] = await Promise.all([readGrowth(), readInbox()]);
  } catch {
    return { ...EMPTY };
  }

  const repliedIds = new Set(
    inbox.map((r) => r.bankKey).filter((k): k is string => !!k)
  );
  const leads = store.leads;

  const discovered = leads.length;
  const contacted = leads.filter(
    (l) => l.status === "sent" || (l.followUpCount || 0) > 0 || !!l.sentAt
  ).length;
  const replied = leads.filter((l) => repliedIds.has(l.id)).length;
  const converted = leads.filter((l) => !!l.convertedAt).length;
  const voiceLeads = leads.filter((l) => l.source === "voice").length;

  const ratio = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : 0);

  return {
    discovered,
    contacted,
    replied,
    converted,
    voiceLeads,
    contactRate: ratio(contacted, discovered),
    replyRate: ratio(replied, contacted),
    conversionRate: ratio(converted, contacted),
  };
}
