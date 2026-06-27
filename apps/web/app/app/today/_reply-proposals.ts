import type { Reply } from "@/lib/replies";
import type { Proposal } from "./_approval-inbox";

/**
 * Turn inbound replies into approval-queue cards so warm inbound sits above
 * cold outreach in the same rhythm. Empty inbox → no cards (the common case
 * until reply ingestion is wired).
 */

const INTENT_COPY: Record<
  Reply["intent"],
  { title: string; meta: string; subject: string }
> = {
  interested: { title: "Interested reply", meta: "Warm", subject: "Re: your inventory" },
  pricing: { title: "Pricing question", meta: "Warm", subject: "Re: pricing" },
  meeting: { title: "Wants a call", meta: "Hot", subject: "Re: a quick call" },
  not_now: { title: "Not now — nurture", meta: "Later", subject: "Re: staying in touch" },
  do_not_contact: { title: "Opt-out — suppress", meta: "DNC", subject: "" },
  other: { title: "Reply to triage", meta: "New", subject: "Re: following up" },
};

export function buildReplyProposals(replies: Reply[]): Proposal[] {
  return replies.map((r) => {
    const copy = INTENT_COPY[r.intent] ?? INTENT_COPY.other;
    const who = r.bankName || r.fromEmail || "A contact";
    return {
      id: `reply-${r.id}`,
      group: "outreach",
      title: `${copy.title} — ${who}`,
      subtitle: r.fromEmail ? `${r.fromEmail} · ${copy.meta}` : copy.meta,
      body: r.snippet || `${who} replied. Triage and respond from the queue.`,
      action: r.intent === "do_not_contact" ? undefined : "send-email",
      subject: copy.subject,
      bankName: r.bankName,
      bankKey: r.bankKey,
      recipientEmail: r.fromEmail,
      primary: r.bankKey
        ? { label: "Open bank", href: `/app/banks/${r.bankKey.replace(/^(fdic|ncua)-/, "")}` }
        : { label: "Open playbook", href: "/app/playbook" },
      meta: copy.meta,
    };
  });
}
