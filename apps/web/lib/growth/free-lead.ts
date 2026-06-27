import "server-only";

import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";
import type { RadarSnapshot } from "@/lib/snapshot";

/**
 * "Free lead" selection — pick ONE real, current seller from the live radar to
 * hand a prospect as proof-of-value ("here's a live target you could go
 * after"). Shared by the email composer and the inbound voice robot. Always
 * returns a REAL bank string (verbatim, never fabricated) or null when the
 * radar is empty — callers omit the proof entirely rather than invent one.
 */

/** Top strong-signal SEC originator, regardless of geography. */
export function genericFreeLead(snap: RadarSnapshot): string | null {
  const strong = snap.originators.find((o) => statusFor(o) === "strong");
  if (!strong) return null;
  const sig = topSignalFor(strong.ticker, snap.top_signals);
  const label = sig
    ? plainSignal(sig.signal_type).label.toLowerCase()
    : "fresh distress signals";
  return `${strong.name || strong.ticker} (${strong.ticker}) — ${label}`;
}

/**
 * Prefer a seller in the given state (from the FDIC/NCUA call-report signals,
 * which carry state) so the proof reads "a live target in your backyard";
 * falls back to the top strong SEC bank, then null.
 */
export function freeLeadForState(
  snap: RadarSnapshot,
  state: string | null
): string | null {
  if (state) {
    const pool = [...(snap.fdic_signals || []), ...(snap.ncua_signals || [])];
    const match = pool.find(
      (s) => (s.state || "").toUpperCase() === state.toUpperCase()
    );
    if (match) {
      const label = (match.signal_type || "rising charge-offs").replace(/_/g, " ");
      const where = match.city ? `${match.city}, ${state}` : state;
      return `${match.originator_name} (${where}) — ${label}`;
    }
  }
  return genericFreeLead(snap);
}
