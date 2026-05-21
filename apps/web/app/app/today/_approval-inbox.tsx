"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CelebrationToast,
  SparkleBurst,
  useDoneCelebration,
} from "../_components/celebrate";
import { fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";

export type ProposalGroup =
  | "outreach"
  | "radar"
  | "launch"
  | "deploy"
  | "customers"
  | "bids";

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
};

const STATE_KEY = "tradeline.approval_state.v2";

type Decision = "approved" | "skipped";
type DecisionMap = Record<string, Decision>;

const GROUP_COPY: Record<
  ProposalGroup,
  { label: string; tone: string }
> = {
  outreach: {
    label: "Outreach",
    tone: "text-[color:var(--color-accent)]",
  },
  radar: {
    label: "Radar",
    tone: "text-[color:var(--color-warn)]",
  },
  launch: {
    label: "Launch",
    tone: "text-[color:var(--color-fg)]",
  },
  deploy: {
    label: "Deploy",
    tone: "text-[color:var(--color-fg)]",
  },
  customers: {
    label: "Customers",
    tone: "text-[color:var(--color-success)]",
  },
  bids: {
    label: "Bids",
    tone: "text-[color:var(--color-accent)]",
  },
};

const GROUP_ORDER: ProposalGroup[] = [
  "outreach",
  "radar",
  "bids",
  "customers",
  "launch",
  "deploy",
];

export function ApprovalInbox({ proposals }: { proposals: Proposal[] }) {
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const celebration = useDoneCelebration();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      if (raw) setDecisions(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(decisions));
    } catch {}
  }, [decisions, hydrated]);

  const pending = useMemo(
    () => proposals.filter((p) => !decisions[p.id]),
    [proposals, decisions]
  );

  const resolved = useMemo(
    () => proposals.filter((p) => decisions[p.id]),
    [proposals, decisions]
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
  onApprove,
  onSkip,
  celebration,
}: {
  group: ProposalGroup;
  items: Proposal[];
  onApprove: (p: Proposal) => void;
  onSkip: (p: Proposal) => void;
  celebration: ReturnType<typeof useDoneCelebration>;
}) {
  const copy = GROUP_COPY[group];
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
      <ol className="space-y-3">
        {items.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            justDone={celebration.isJustDone(p.id)}
            onApprove={() => onApprove(p)}
            onSkip={() => onSkip(p)}
          />
        ))}
      </ol>
    </div>
  );
}

function ProposalCard({
  proposal,
  justDone,
  onApprove,
  onSkip,
}: {
  proposal: Proposal;
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
          <h3 className="font-serif text-[20px] md:text-[22px] tracking-tight text-[color:var(--color-fg)] leading-tight">
            {proposal.title}
          </h3>
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
          onSent={onApprove}
          onSkip={onSkip}
          secondary={proposal.secondary || proposal.primary}
          justDone={justDone}
        />
      ) : (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Link
            href={proposal.primary.href}
            onClick={onApprove}
            className="btn-primary relative"
          >
            {proposal.primary.label}
            {justDone && <SparkleBurst />}
          </Link>
          {proposal.secondary && (
            <Link
              href={proposal.secondary.href}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              {proposal.secondary.label}
            </Link>
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

function OutreachSendForm({
  subject,
  text,
  replyTo,
  onSent,
  onSkip,
  secondary,
  justDone,
}: {
  subject: string;
  text: string;
  replyTo?: string;
  onSent: () => void;
  onSkip: () => void;
  secondary: { label: string; href: string };
  justDone: boolean;
}) {
  const [recipient, setRecipient] = useState("");
  const [send, setSend] = useState<SendState>({ kind: "idle" });

  const submit = async () => {
    const to = recipient.trim();
    if (!to) return;
    setSend({ kind: "sending" });
    try {
      const r = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, replyTo }),
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
      onSent();
    } catch (err) {
      setSend({ kind: "error", message: (err as Error).message });
    }
  };

  const mailto = `mailto:${encodeURIComponent(
    recipient
  )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="broker@example.com"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)]"
        />
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
        <Link
          href={secondary.href}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          {secondary.label}
        </Link>
        <button
          type="button"
          onClick={onSkip}
          className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-warn)] transition"
        >
          Skip
        </button>
      </div>
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
