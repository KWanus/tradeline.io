import "server-only";

import { readSnapshot } from "@/lib/snapshot";
import { buildQueueFromSnapshot } from "./runner";
import { readState } from "./state";

/**
 * A read-only preview of what autopilot would send on its next run. Surfaced
 * inline on /app/today's "Up next" panel so the operator can see the queue
 * without opening /app/autopilot. Never sends — pure projection of state +
 * the current snapshot.
 */

export type QueuePreviewItem = {
  bankKey: string;
  bankName: string;
  audience: "sec" | "fdic" | "ncua";
  signalLabel: string;
  subject: string;
};

export type QueuePreview = {
  enabled: boolean;
  dryRun: boolean;
  pausedReason: string | null;
  dailyCap: number;
  total: number;
  items: QueuePreviewItem[];
};

const MAX_PREVIEW = 5;

/**
 * Build the preview. Returns null when there's nothing to show (empty queue or
 * an unreadable snapshot) so the caller can simply hide the panel.
 */
export async function computeQueuePreview(): Promise<QueuePreview | null> {
  const state = await readState();

  let snap;
  try {
    snap = await readSnapshot();
  } catch {
    return null;
  }

  const queue = buildQueueFromSnapshot(snap, state.audiences);
  if (queue.length === 0) return null;

  return {
    enabled: state.enabled,
    dryRun: state.dryRun,
    pausedReason: state.pausedReason,
    dailyCap: state.dailyCap,
    total: queue.length,
    items: queue.slice(0, MAX_PREVIEW).map((q) => ({
      bankKey: q.bankKey,
      bankName: q.bankName,
      audience: q.audience,
      signalLabel: q.signalLabel,
      subject: q.subject,
    })),
  };
}
