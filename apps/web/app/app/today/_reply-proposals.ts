import "server-only";

import type { InboundReply } from "@/lib/replies";
import type { Proposal } from "./_approval-inbox";

/**
 * Fold warm inbound replies into the same approval queue as cold outreach.
 * Each unhandled reply becomes a "send-email" proposal pre-seeded with the
 * classifier's drafted response, so the operator approves a reply the same way
 * they approve an outreach. Reply cards are returned first (and the page
 * prepends them) so warm inbound sits above cold outreach.
 */

// Display label + a rough priority per classifier verdict. Lower sort = higher.
const INTENT_META: Record<
  string,
  { label: string; priority: number }
> = {
  warm: { label: "Interested — wants to talk", priority: 0 },
  "has-tape": { label: "Has a tape to share", priority: 0 },
  "wants-info": { label: "Wants your profile / license", priority: 1 },
  "tape-detail-request": { label: "Needs deal details", priority: 1 },
  "needs-license": { label: "Asking about licensing", priority: 2 },
  "panel-only": { label: "Panel-only gate", priority: 3 },
  passing: { label: "Polite pass", priority: 4 },
  unclear: { label: "Needs a read", priority: 3 },
};

export function buildReplyProposals(replies: InboundReply[]): Proposal[] {
  const pending = replies.filter((r) => !r.handledAt);
  const sorted = [...pending].sort((a, b) => {
    const pa = INTENT_META[a.classification || "unclear"]?.priority ?? 3;
    const pb = INTENT_META[b.classification || "unclear"]?.priority ?? 3;
    if (pa !== pb) return pa - pb;
    // Newer first within the same priority.
    return a.receivedAt < b.receivedAt ? 1 : -1;
  });

  return sorted.map((r) => {
    const meta = INTENT_META[r.classification || "unclear"] || {
      label: "Reply received",
      priority: 3,
    };
    const who = r.fromName || r.bankName || r.fromEmail;
    const subject =
      r.suggestedSubject ||
      (r.subject ? `Re: ${r.subject}` : `Re: your note`);
    const draft =
      r.suggestedReply ||
      `Hi ${r.fromName ? r.fromName.split(" ")[0] : "there"},\n\nThanks for getting back to me.\n\n[YOUR_NAME]`;

    return {
      id: `reply-${r.id}`,
      group: "outreach",
      title: `Reply to ${who}`,
      subtitle: `${meta.label}${r.bankName ? ` · ${r.bankName}` : ""}`,
      body:
        r.summary ||
        (r.body.length > 240 ? `${r.body.slice(0, 240)}…` : r.body),
      action: "send-email",
      recipientEmail: r.fromEmail,
      bankKey: r.bankKey,
      bankName: r.bankName,
      subject,
      draft,
      primary: { label: "Open replies", href: "/app/inbox/replies" },
      meta: meta.label,
    };
  });
}
