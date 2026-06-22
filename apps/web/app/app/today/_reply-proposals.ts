import { INTENT_LABEL, INTENT_RANK, type Reply } from "@/lib/replies";
import type { Proposal } from "./_approval-inbox";

/**
 * Turn inbound broker replies into approval-inbox cards. Warm inbound
 * (has-tape / interested) sorts above polite passes via INTENT_RANK so the
 * operator works the hottest threads first. Acknowledged replies drop out —
 * approving a card is what acknowledges it (handled client-side).
 */
export function buildReplyProposals(replies: Reply[]): Proposal[] {
  const pending = replies
    .filter((r) => !r.acknowledged && r.intent !== "unsubscribe")
    .sort((a, b) => {
      const byRank = INTENT_RANK[a.intent] - INTENT_RANK[b.intent];
      if (byRank !== 0) return byRank;
      return b.receivedAt.localeCompare(a.receivedAt);
    });

  return pending.map((r) => {
    const who = r.fromName ? `${r.fromName} (${r.from})` : r.from;
    const label = INTENT_LABEL[r.intent];
    const snippet = r.body.replace(/\s+/g, " ").trim().slice(0, 500);

    // Where the operator goes next: the deal if we have one, else the bank
    // page, else the generic reply classifier so they can draft a response.
    const primary = r.dealId
      ? { label: "Open deal", href: `/app/pipeline?dealId=${encodeURIComponent(r.dealId)}` }
      : r.bankKey && !r.bankKey.includes("-")
        ? { label: `Open ${r.bankKey}`, href: `/app/banks/${r.bankKey}` }
        : { label: "Draft a reply", href: "/app/inbox" };

    return {
      id: `reply-${r.id}`,
      group: "outreach",
      title: `Reply from ${r.fromName || r.from} — ${label.toLowerCase()}`,
      subtitle: `${who}${r.bankName ? ` · ${r.bankName}` : ""}${
        r.subject ? ` · ${r.subject}` : ""
      }`,
      body: snippet || "(no message body)",
      primary,
      meta: r.intent === "has_tape" || r.intent === "interested" ? "Warm" : "Inbound",
    } satisfies Proposal;
  });
}
