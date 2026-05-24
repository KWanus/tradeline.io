/**
 * Shared between server (autopilot log writer) and client (send/outcome
 * forms). Kept in its own file so the client can import without pulling in
 * state.ts's `server-only` graph.
 */

export type Audience = "sec" | "fdic" | "ncua";

/** SEC bank keys are bare tickers ("WAL"); FDIC keys are "fdic-<cert>",
 * NCUA keys are "ncua-<cert>". Anything else falls back to "sec". */
export function audienceForBankKey(bankKey: string): Audience {
  if (bankKey.startsWith("fdic-")) return "fdic";
  if (bankKey.startsWith("ncua-")) return "ncua";
  return "sec";
}
