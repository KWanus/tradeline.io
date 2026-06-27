import "server-only";

/**
 * Inbound reply inbox. There is no live reply-ingestion source wired yet
 * (replies would arrive via an email webhook in a later phase), so `readInbox`
 * returns an empty list today. The Today page is built to degrade gracefully:
 * no replies → no reply cards, no ribbon counts. When ingestion lands, this is
 * the single seam to populate.
 */

export type ReplyIntent =
  | "interested"
  | "pricing"
  | "meeting"
  | "not_now"
  | "do_not_contact"
  | "other";

export type Reply = {
  id: string;
  bankKey?: string;
  bankName?: string;
  fromEmail?: string;
  intent: ReplyIntent;
  snippet?: string;
  receivedAt: string; // ISO
};

export async function readInbox(): Promise<Reply[]> {
  // No inbound source yet — honest empty. Do not fabricate replies.
  return [];
}
