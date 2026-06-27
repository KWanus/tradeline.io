import "server-only";

import { readState } from "@/lib/autopilot/state";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";

/**
 * "Up next" preview — the top items the autopilot batch would send on its next
 * run, surfaced inline on Today so the operator can see what's queued without
 * opening /app/autopilot. This mirrors the runner's queue-building heuristic
 * (highest-signal banks first) but does NOT send anything.
 *
 * Returns null when there's nothing to preview (empty snapshot), so the caller
 * can simply hide the panel.
 */

export type QueuePreviewItem = {
  ticker: string;
  name: string;
  audience: "sec" | "fdic" | "ncua";
  reason: string;
};

export type QueuePreview = {
  enabled: boolean;
  dryRun: boolean;
  dailyCap: number;
  items: QueuePreviewItem[];
  /** How many candidates exist beyond the previewed slice. */
  total: number;
};

export async function computeQueuePreview(): Promise<QueuePreview | null> {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {
    snap = EMPTY_SNAPSHOT;
  }

  const state = await readState();

  // Rank: strong signals first, then watching. Same order the runner favors.
  const ranked = snap.originators
    .map((o) => ({ o, status: statusFor(o) }))
    .filter((x) => x.status === "strong" || x.status === "watching")
    .sort((a, b) => {
      const w = (s: string) => (s === "strong" ? 0 : 1);
      return w(a.status) - w(b.status);
    });

  if (ranked.length === 0) return null;

  const cap = Math.max(1, state.dailyCap || 5);
  const items: QueuePreviewItem[] = ranked.slice(0, cap).map(({ o }) => {
    const sig = topSignalFor(o.ticker, snap.top_signals);
    const reason = sig ? plainSignal(sig.signal_type).label : "Filing activity flagged";
    return { ticker: o.ticker, name: o.name || o.ticker, audience: "sec", reason };
  });

  return {
    enabled: state.enabled,
    dryRun: state.dryRun,
    dailyCap: cap,
    items,
    total: ranked.length,
  };
}
