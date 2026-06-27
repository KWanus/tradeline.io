import "server-only";

/**
 * Server-side do-not-contact check, called before any outbound send. There is
 * no server DNC store wired yet (suppressions live client-side in /app/inbox),
 * so this returns `undefined` (= not suppressed) and never blocks a send
 * incorrectly. When a server DNC list is added (e.g. a file on the data branch),
 * this is the one function to implement.
 */

export type DncHit = { reason: string; addedAt: string };

export async function dncHitServer(
  _to: string,
  _bankKey?: string
): Promise<DncHit | undefined> {
  return undefined;
}
