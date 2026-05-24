"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import {
  CelebrationToast,
  SparkleBurst,
  useDoneCelebration,
} from "../_components/celebrate";
import { fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";
import { getBankContact, setBankContact } from "@/lib/bank-contacts";
import { type Contact, addContact, readContacts } from "@/lib/contacts";
import { markSeen, readSeenIds } from "@/lib/inbox-history";
import {
  DAILY_SEND_CAP,
  getRemainingToday,
  recordSend,
} from "@/lib/daily-sends";
import { buildLocalProposals } from "./_local-proposals";

export type ProposalGroup =
  | "compliance"
  | "capital"
  | "outreach"
  | "radar"
  | "bids"
  | "closing"
  | "customers"
  | "portfolio"
  | "launch"
  | "deploy";

export type Proposal = {
  id: string;
  group: ProposalGroup;
  title: string;
  subtitle?: string;
  body: string;
  draft?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  meta?: string;
  /** If set to "send-email", the card renders inline recipient + send UI
   * and approve fires /api/send-outreach directly. Otherwise it navigates. */
  action?: "send-email";
  subject?: string;
  /** Context for fillTemplate — typically the bank ticker / name. */
  bankName?: string;
  /** Stable key per bank for contact recall: ticker for SEC banks,
   * "fdic-<cert>" for FDIC banks, "ncua-<cert>" for credit unions. */
  bankKey?: string;
  /** Recipient email to seed the send form with (used for customer renewals
   * where the recipient is the customer themselves). bankKey-saved value
   * still wins when both are present. */
  recipientEmail?: string;
};

const STATE_KEY = "tradeline.approval_state.v2";

function formatAgo(iso: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Decision = "approved" | "skipped";
type DecisionMap = Record<string, Decision>;

const GROUP_COPY: Record<
  ProposalGroup,
  { label: string; tone: string }
> = {
  compliance: {
    label: "Compliance",
    tone: "text-[color:var(--color-danger)]",
  },
  capital: {
    label: "Capital",
    tone: "text-[color:var(--color-danger)]",
  },
  outreach: {
    label: "Outreach",
    tone: "text-[color:var(--color-accent)]",
  },
  radar: {
    label: "Radar",
    tone: "text-[color:var(--color-warn)]",
  },
  bids: {
    label: "Bids",
    tone: "text-[color:var(--color-accent)]",
  },
  closing: {
    label: "Closing",
    tone: "text-[color:var(--color-success)]",
  },
  customers: {
    label: "Customers",
    tone: "text-[color:var(--color-success)]",
  },
  portfolio: {
    label: "Portfolio",
    tone: "text-[color:var(--color-success)]",
  },
  launch: {
    label: "Launch",
    tone: "text-[color:var(--color-fg)]",
  },
  deploy: {
    label: "Deploy",
    tone: "text-[color:var(--color-fg)]",
  },
};

// Compliance first — an expired license is the only thing that stops the
// whole business — then revenue work, then owned-book upkeep, then setup.
const GROUP_ORDER: ProposalGroup[] = [
  "compliance",
  "capital",
  "outreach",
  "radar",
  "bids",
  "closing",
  "customers",
  "portfolio",
  "launch",
  "deploy",
];

export function ApprovalInbox({
  proposals,
  generatedAt,
}: {
  proposals: Proposal[];
  generatedAt?: string;
}) {
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [localProposals, setLocalProposals] = useState<Proposal[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const celebration = useDoneCelebration();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      if (raw) setDecisions(JSON.parse(raw));
    } catch {}
    // Server proposals come from the snapshot; these come from browser-local
    // data (compliance licenses, owned portfolio) the server can't see.
    setLocalProposals(buildLocalProposals());
    setHydrated(true);
  }, []);

  // After hydration, compute which pending proposals are new since the
  // operator's last visit, then mark all current pending as seen so they
  // won't be flagged "new" next time. Runs once per mount (deps: [hydrated]).
  useEffect(() => {
    if (!hydrated) return;
    const seen = readSeenIds();
    const pendingIds = [...proposals, ...localProposals]
      .filter((p) => !decisions[p.id])
      .map((p) => p.id);
    if (pendingIds.length === 0) return;
    const fresh = new Set(pendingIds.filter((id) => !seen.has(id)));
    setNewIds(fresh);
    markSeen(pendingIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on hydrate
  }, [hydrated]);

  const allProposals = useMemo(
    () => [...proposals, ...localProposals],
    [proposals, localProposals]
  );

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(decisions));
    } catch {}
  }, [decisions, hydrated]);

  const pending = useMemo(
    () => allProposals.filter((p) => !decisions[p.id]),
    [allProposals, decisions]
  );

  const resolved = useMemo(
    () => allProposals.filter((p) => decisions[p.id]),
    [allProposals, decisions]
  );

  const grouped = useMemo(() => {
    const map = new Map<ProposalGroup, Proposal[]>();
    for (const p of pending) {
      const arr = map.get(p.group) ?? [];
      arr.push(p);
      map.set(p.group, arr);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map(
      (g) => [g, map.get(g)!] as const
    );
  }, [pending]);

  const decide = (id: string, choice: Decision, title: string) => {
    setDecisions((d) => ({ ...d, [id]: choice }));
    if (choice === "approved") {
      celebration.trigger(id, `Approved · ${title}`);
    }
  };

  const reopen = (id: string) => {
    setDecisions((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  };

  const approvedCount = resolved.filter(
    (p) => decisions[p.id] === "approved"
  ).length;
  const skippedCount = resolved.length - approvedCount;

  return (
    <section className="mb-12">
      <header className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Inbox
          </div>
          <h2 className="mt-1 font-serif italic text-3xl md:text-4xl tracking-tight text-[color:var(--color-fg)]">
            {pending.length > 0 ? (
              <>
                {pending.length} ready for your{" "}
                <span className="text-gradient-accent not-italic">approval</span>
              </>
            ) : (
              <>
                All clear. <span className="text-gradient-accent not-italic">Nothing waiting.</span>
              </>
            )}
          </h2>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
            Work the platform prepared for you overnight. One click per card —
            approve and ship, edit if it&rsquo;s off, skip if it&rsquo;s not for you.
          </p>
          {hydrated && (newIds.size > 0 || generatedAt) && (
            <div className="mt-2 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] flex items-center gap-3 flex-wrap">
              {newIds.size > 0 && (
                <span className="text-[color:var(--color-accent)]">
                  ✨ {newIds.size} new since your last visit
                </span>
              )}
              {generatedAt && (
                <span>Radar refreshed {formatAgo(generatedAt)}</span>
              )}
            </div>
          )}
        </div>
        {resolved.length > 0 && (
          <button
            type="button"
            onClick={() => setShowResolved((s) => !s)}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            {showResolved ? "Hide" : "Show"} resolved ({approvedCount}✓ /{" "}
            {skippedCount}↷)
          </button>
        )}
      </header>

      {hydrated && pending.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-8 text-center">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Inbox zero
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] max-w-md mx-auto leading-relaxed">
            Radar runs every 6 hours; outreach and customer drafts queue here
            as they&rsquo;re generated. Come back tomorrow morning.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, items]) => (
            <GroupBlock
              key={group}
              group={group}
              items={items}
              newIds={newIds}
              onApprove={(p) =>
                decide(p.id, "approved", p.title)
              }
              onSkip={(p) => decide(p.id, "skipped", p.title)}
              celebration={celebration}
            />
          ))}
        </div>
      )}

      {showResolved && resolved.length > 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
            Resolved today
          </div>
          <ul className="space-y-2">
            {resolved.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 text-[13px] text-[color:var(--color-fg-dim)]"
              >
                <span
                  className={`font-mono text-[11px] ${
                    decisions[p.id] === "approved"
                      ? "text-[color:var(--color-success)]"
                      : "text-[color:var(--color-fg-faint)]"
                  }`}
                >
                  {decisions[p.id] === "approved" ? "✓" : "↷"}
                </span>
                <span className="flex-1 truncate">{p.title}</span>
                <button
                  type="button"
                  onClick={() => reopen(p.id)}
                  className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)] transition"
                >
                  Reopen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CelebrationToast message={celebration.toast} />
    </section>
  );
}

function GroupBlock({
  group,
  items,
  newIds,
  onApprove,
  onSkip,
  celebration,
}: {
  group: ProposalGroup;
  items: Proposal[];
  newIds: Set<string>;
  onApprove: (p: Proposal) => void;
  onSkip: (p: Proposal) => void;
  celebration: ReturnType<typeof useDoneCelebration>;
}) {
  const copy = GROUP_COPY[group];
  const sendable = items.filter((p) => p.action === "send-email");
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span
          className={`font-mono text-[10px] tracking-[0.22em] uppercase ${copy.tone}`}
        >
          {copy.label}
        </span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          · {items.length}
        </span>
      </div>
      {group === "outreach" && sendable.length > 1 && (
        <BulkSendStrip items={sendable} onApprove={onApprove} />
      )}
      <ol className="space-y-3">
        {items.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            isNew={newIds.has(p.id)}
            justDone={celebration.isJustDone(p.id)}
            onApprove={() => onApprove(p)}
            onSkip={() => onSkip(p)}
          />
        ))}
      </ol>
    </div>
  );
}

type BulkProgress =
  | { kind: "idle"; ready: number; missing: number; remainingToday: number }
  | { kind: "running"; sent: number; failed: number; total: number; currentLabel: string }
  | {
      kind: "done";
      sent: number;
      failed: number;
      skippedNoRecipient: number;
      capReached: boolean;
    };

function BulkSendStrip({
  items,
  onApprove,
}: {
  items: Proposal[];
  onApprove: (p: Proposal) => void;
}) {
  const [profile] = useBuyerProfile();
  const [progress, setProgress] = useState<BulkProgress | null>(null);

  // Recompute readiness on mount + when items change. Reads localStorage,
  // so must run client-side after hydration.
  useEffect(() => {
    let ready = 0;
    let missing = 0;
    for (const p of items) {
      if (p.bankKey && getBankContact(p.bankKey)) ready++;
      else missing++;
    }
    setProgress({
      kind: "idle",
      ready,
      missing,
      remainingToday: getRemainingToday(),
    });
  }, [items]);

  if (!progress) return null;

  const sendAll = async () => {
    let sent = 0;
    let failed = 0;
    let skippedNoRecipient = 0;
    let capReached = false;
    const queue: { proposal: Proposal; to: string }[] = [];

    for (const p of items) {
      const to = getBankContact(p.bankKey);
      if (!to) {
        skippedNoRecipient++;
        continue;
      }
      queue.push({ proposal: p, to });
    }

    if (queue.length === 0) {
      setProgress({
        kind: "done",
        sent: 0,
        failed: 0,
        skippedNoRecipient,
        capReached: false,
      });
      return;
    }

    setProgress({
      kind: "running",
      sent: 0,
      failed: 0,
      total: queue.length,
      currentLabel: queue[0].proposal.bankName || queue[0].to,
    });

    for (let i = 0; i < queue.length; i++) {
      const { proposal, to } = queue[i];
      if (getRemainingToday() <= 0) {
        capReached = true;
        break;
      }

      const subject = proposal.subject
        ? fillTemplate(proposal.subject, profile, { bankName: proposal.bankName })
        : "";
      const text = proposal.draft
        ? fillTemplate(proposal.draft, profile, { bankName: proposal.bankName })
        : "";
      if (!subject || !text) {
        failed++;
        continue;
      }

      try {
        const r = await fetch("/api/send-outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            subject,
            text,
            replyTo: profile.email || undefined,
          }),
        });
        const data = await r.json();
        if (data.enabled === false) {
          failed++;
          // RESEND_API_KEY missing — no point continuing the queue.
          capReached = false;
          break;
        }
        if (!r.ok || data.error) {
          failed++;
        } else {
          sent++;
          addContact(to);
          recordSend();
          onApprove(proposal);
        }
      } catch {
        failed++;
      }

      setProgress({
        kind: "running",
        sent,
        failed,
        total: queue.length,
        currentLabel: queue[i].proposal.bankName || queue[i].to,
      });

      // Throttle: ~1s between sends to keep domain reputation healthy and
      // avoid any per-second rate-limit on Resend's side.
      if (i < queue.length - 1) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    setProgress({
      kind: "done",
      sent,
      failed,
      skippedNoRecipient,
      capReached,
    });
  };

  if (progress.kind === "idle") {
    const canSend = progress.ready > 0 && progress.remainingToday > 0;
    return (
      <div className="mb-3 flex items-center gap-3 flex-wrap rounded-xl border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-soft)] px-4 py-3">
        <div className="flex-1 min-w-[200px] text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
          <span className="text-[color:var(--color-fg)] font-medium">
            {progress.ready}
          </span>{" "}
          ready to send
          {progress.missing > 0 && (
            <>
              {" · "}
              <span className="text-[color:var(--color-warn)]">
                {progress.missing}
              </span>{" "}
              need a recipient first
            </>
          )}
          {" · "}
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            {progress.remainingToday}/{DAILY_SEND_CAP} sends left today
          </span>
        </div>
        <button
          type="button"
          onClick={sendAll}
          disabled={!canSend}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send all {progress.ready > 0 ? progress.ready : ""} ready
        </button>
      </div>
    );
  }

  if (progress.kind === "running") {
    const total = progress.total;
    const done = progress.sent + progress.failed;
    const pct = total === 0 ? 0 : (done / total) * 100;
    return (
      <div className="mb-3 rounded-xl border border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)] px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-[color:var(--color-fg)]">
            Sending {done + 1}/{total} —{" "}
            <span className="text-[color:var(--color-fg-dim)]">
              {progress.currentLabel}
            </span>
          </div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)]">
            ✓ {progress.sent} · ✗ {progress.failed}
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[color:var(--color-bg-1)] overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-soft)] px-4 py-3">
      <div className="text-[12px] text-[color:var(--color-fg)]">
        Done.{" "}
        <span className="text-[color:var(--color-success)]">
          {progress.sent} sent
        </span>
        {progress.failed > 0 && (
          <>
            {" · "}
            <span className="text-[color:var(--color-danger)]">
              {progress.failed} failed
            </span>
          </>
        )}
        {progress.skippedNoRecipient > 0 && (
          <>
            {" · "}
            <span className="text-[color:var(--color-warn)]">
              {progress.skippedNoRecipient} skipped (no recipient)
            </span>
          </>
        )}
      </div>
      {progress.capReached && (
        <div className="mt-1 text-[11px] text-[color:var(--color-warn)] leading-snug">
          Hit today&rsquo;s {DAILY_SEND_CAP}-send cap. Sending more risks
          your domain reputation — come back tomorrow.
        </div>
      )}
      {progress.skippedNoRecipient > 0 && (
        <div className="mt-1 text-[11px] text-[color:var(--color-fg-dim)] leading-snug">
          Fill in a recipient on the cards below, then click Send all again —
          the system remembers each one for next time.
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  isNew,
  justDone,
  onApprove,
  onSkip,
}: {
  proposal: Proposal;
  isNew?: boolean;
  justDone: boolean;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const [profile] = useBuyerProfile();
  const isSendEmail = proposal.action === "send-email";
  const personalizedDraft = useMemo(() => {
    if (!proposal.draft) return undefined;
    return fillTemplate(proposal.draft, profile, {
      bankName: proposal.bankName,
    });
  }, [proposal.draft, proposal.bankName, profile]);
  const personalizedSubject = useMemo(() => {
    if (!proposal.subject) return undefined;
    return fillTemplate(proposal.subject, profile, {
      bankName: proposal.bankName,
    });
  }, [proposal.subject, proposal.bankName, profile]);

  return (
    <li
      className={`relative rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 md:p-6 transition ${
        justDone ? "animate-row-glow" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            {isNew && (
              <span
                className="font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded text-[#1a0c00] font-semibold"
                style={{ background: "var(--gradient-primary)" }}
                title="New since your last visit"
              >
                New
              </span>
            )}
            <h3 className="font-serif text-[20px] md:text-[22px] tracking-tight text-[color:var(--color-fg)] leading-tight">
              {proposal.title}
            </h3>
          </div>
          {proposal.subtitle && (
            <div className="mt-1 font-mono text-[11px] tracking-wide text-[color:var(--color-fg-faint)]">
              {proposal.subtitle}
            </div>
          )}
        </div>
        {proposal.meta && (
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] whitespace-nowrap">
            {proposal.meta}
          </span>
        )}
      </div>

      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {proposal.body}
      </p>

      {personalizedDraft && (
        <div className="mt-3 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-4 py-3">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
            {personalizedSubject ? `Subject: ${personalizedSubject}` : "Draft"}
          </div>
          <pre className="font-sans text-[13px] text-[color:var(--color-fg)] leading-relaxed whitespace-pre-wrap">
            {personalizedDraft}
          </pre>
        </div>
      )}

      {isSendEmail && personalizedSubject && personalizedDraft ? (
        <OutreachSendForm
          subject={personalizedSubject}
          text={personalizedDraft}
          replyTo={profile.email || undefined}
          bankKey={proposal.bankKey}
          bankName={proposal.bankName}
          initialRecipient={proposal.recipientEmail}
          onSent={onApprove}
          onSkip={onSkip}
          secondary={proposal.secondary || proposal.primary}
          justDone={justDone}
        />
      ) : (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <a
            href={proposal.primary.href}
            onClick={onApprove}
            className="btn-primary relative"
          >
            {proposal.primary.label}
            {justDone && <SparkleBurst />}
          </a>
          {proposal.secondary && (
            <a
              href={proposal.secondary.href}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              {proposal.secondary.label}
            </a>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-warn)] transition"
          >
            Skip
          </button>
        </div>
      )}
    </li>
  );
}

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; messageId: string }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

type PersonalizeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

function OutreachSendForm({
  subject,
  text,
  replyTo,
  bankKey,
  bankName,
  initialRecipient,
  onSent,
  onSkip,
  secondary,
  justDone,
}: {
  subject: string;
  text: string;
  replyTo?: string;
  bankKey?: string;
  bankName?: string;
  initialRecipient?: string;
  onSent: () => void;
  onSkip: () => void;
  secondary: { label: string; href: string };
  justDone: boolean;
}) {
  const [profile] = useBuyerProfile();
  const [recipient, setRecipient] = useState("");
  const [send, setSend] = useState<SendState>({ kind: "idle" });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  // Personalize: AI rewrite of the templated draft (and the live state).
  const [personalized, setPersonalized] = useState<{
    subject: string;
    draft: string;
  } | null>(null);
  const [personalize, setPersonalize] = useState<PersonalizeState>({
    kind: "idle",
  });
  const datalistId = useId();

  // Effective subject/body — AI version wins when present.
  const effectiveSubject = personalized?.subject || subject;
  const effectiveText = personalized?.draft || text;

  useEffect(() => {
    setContacts(readContacts());
    const saved = getBankContact(bankKey);
    if (saved) {
      setRecipient(saved);
      setPrefilled(true);
    } else if (initialRecipient) {
      setRecipient(initialRecipient);
      setPrefilled(true);
    }
  }, [bankKey, initialRecipient]);

  const runPersonalize = async () => {
    setPersonalize({ kind: "loading" });
    try {
      const r = await fetch("/api/personalize-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          draft: text,
          bankName,
          bankKey,
          profile,
        }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setPersonalize({ kind: "disabled" });
        return;
      }
      if (!r.ok || data.error) {
        setPersonalize({
          kind: "error",
          message: data.error || `HTTP ${r.status}`,
        });
        return;
      }
      if (typeof data.subject === "string" && typeof data.draft === "string") {
        setPersonalized({ subject: data.subject, draft: data.draft });
        setPersonalize({ kind: "ok" });
      } else {
        setPersonalize({ kind: "error", message: "malformed response" });
      }
    } catch (err) {
      setPersonalize({ kind: "error", message: (err as Error).message });
    }
  };

  const revertPersonalized = () => {
    setPersonalized(null);
    setPersonalize({ kind: "idle" });
  };

  const submit = async () => {
    const to = recipient.trim();
    if (!to) return;
    setSend({ kind: "sending" });
    try {
      const r = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: effectiveSubject,
          text: effectiveText,
          replyTo,
        }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setSend({ kind: "disabled" });
        return;
      }
      if (!r.ok || data.error) {
        setSend({
          kind: "error",
          message: data.error || `HTTP ${r.status}`,
        });
        return;
      }
      setSend({ kind: "ok", messageId: data.providerMessageId || "" });
      // Remember the recipient so the next outreach card autocompletes it.
      setContacts(addContact(to));
      // Pin this recipient to this specific bank so the *same* bank's next
      // card prefills instantly — turns the daily queue into one-click after
      // it's seeded once.
      if (bankKey) setBankContact(bankKey, to);
      recordSend();
      onSent();
    } catch (err) {
      setSend({ kind: "error", message: (err as Error).message });
    }
  };

  const mailto = `mailto:${encodeURIComponent(
    recipient
  )}?subject=${encodeURIComponent(effectiveSubject)}&body=${encodeURIComponent(
    effectiveText
  )}`;

  return (
    <div className="mt-4 space-y-3">
      {prefilled && send.kind !== "ok" && (
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-success)]">
          Recipient remembered from last send to this bank ✓
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          list={datalistId}
          placeholder="broker@example.com"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            if (prefilled) setPrefilled(false);
          }}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)]"
        />
        <datalist id={datalistId}>
          {contacts.map((c) => (
            <option key={c.email} value={c.email}>
              {c.label !== c.email ? c.label : ""}
            </option>
          ))}
        </datalist>
        <button
          type="button"
          onClick={submit}
          disabled={!recipient.trim() || send.kind === "sending"}
          className="btn-primary relative disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {send.kind === "sending"
            ? "Sending…"
            : send.kind === "ok"
              ? "Sent ✓"
              : "Approve & send"}
          {justDone && <SparkleBurst />}
        </button>
        <a
          href={mailto}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          Open in mail app
        </a>
        <button
          type="button"
          onClick={runPersonalize}
          disabled={personalize.kind === "loading"}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {personalize.kind === "loading"
            ? "Personalizing…"
            : personalized
              ? "Re-personalize"
              : "✨ Personalize with AI"}
        </button>
        <a
          href={secondary.href}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          {secondary.label}
        </a>
        <button
          type="button"
          onClick={onSkip}
          className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-warn)] transition"
        >
          Skip
        </button>
      </div>
      {personalized && (
        <div className="rounded-lg border border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)] px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)]">
              ✨ AI-personalized — used on send
            </div>
            <button
              type="button"
              onClick={revertPersonalized}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-warn)] transition"
            >
              Revert to template
            </button>
          </div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
            Subject: {personalized.subject}
          </div>
          <pre className="font-sans text-[13px] text-[color:var(--color-fg)] leading-relaxed whitespace-pre-wrap">
            {personalized.draft}
          </pre>
        </div>
      )}
      {personalize.kind === "disabled" && (
        <p className="text-[12px] text-[color:var(--color-warn)] leading-relaxed">
          AI personalize is off. Set{" "}
          <code className="font-mono">ANTHROPIC_API_KEY</code> on the server to
          enable per-card AI rewriting.
        </p>
      )}
      {personalize.kind === "error" && (
        <p className="text-[12px] text-[color:var(--color-danger)] leading-relaxed">
          Personalize failed: {personalize.message}
        </p>
      )}
      {send.kind === "disabled" && (
        <p className="text-[12px] text-[color:var(--color-warn)] leading-relaxed">
          Auto-send is off. Set <code className="font-mono">RESEND_API_KEY</code>{" "}
          (and <code className="font-mono">RESEND_FROM</code>) in your Vercel env
          to enable one-click sends, or use{" "}
          <span className="underline">Open in mail app</span> to send manually.
        </p>
      )}
      {send.kind === "error" && (
        <p className="text-[12px] text-[color:var(--color-danger)] leading-relaxed">
          Send failed: {send.message}
        </p>
      )}
      {send.kind === "ok" && (
        <p className="text-[12px] text-[color:var(--color-success)] leading-relaxed">
          Sent ✓ {send.messageId ? `(${send.messageId})` : ""}
        </p>
      )}
    </div>
  );
}
