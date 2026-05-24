"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type Buyer,
  type ColdBuyer,
  coldBuyers,
  dismissReengagement,
  recordIntroSentTo,
} from "@/lib/buyer-book";
import { type BuyerProfile, fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";
import { addContact } from "@/lib/contacts";
import { recordSend } from "@/lib/daily-sends";

function formatAge(days: number): string {
  if (days < 60) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.round(months / 12);
  return `${years}y`;
}

type RowState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

function buildReengageSubject(buyer: Buyer): string {
  return `Checking in — anything you're actively buying for ${buyer.firm}?`;
}

function buildReengageBody(buyer: Buyer, profile: BuyerProfile): string {
  const assetMention =
    buyer.assetClasses.length > 0
      ? buyer.assetClasses.slice(0, 2).join(" or ")
      : "your usual asset classes";
  const stateMention =
    buyer.licensedStates.length > 0
      ? ` (especially ${buyer.licensedStates.slice(0, 3).join(", ")})`
      : "";
  return fillTemplate(
    [
      `Hi ${buyer.contactName || buyer.firm},`,
      ``,
      `Been a while — wanted to check in on what ${buyer.firm} is actively buying right now.`,
      ``,
      `If you're still in the market for ${assetMention}${stateMention}, I've got a few sellers I'm working with and can run a tape past you the next time something fits. Anything off-script you're hunting for?`,
      ``,
      `Either way, happy to send my updated seller pipeline if useful.`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
      `[PHONE] · [EMAIL]`,
    ].join("\n"),
    profile
  );
}

async function sendReengage(
  buyer: Buyer,
  profile: BuyerProfile
): Promise<RowState> {
  if (!buyer.email) {
    return { kind: "error", message: "buyer has no email saved" };
  }
  try {
    const r = await fetch("/api/send-outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: buyer.email,
        subject: buildReengageSubject(buyer),
        text: buildReengageBody(buyer, profile),
        replyTo: profile.email || undefined,
        bankKey: `broker-reengage-${buyer.id}`,
        bankName: buyer.firm,
      }),
    });
    const data = await r.json();
    if (data.enabled === false) return { kind: "disabled" };
    if (!r.ok || data.error) {
      return { kind: "error", message: data.error || `HTTP ${r.status}` };
    }
    addContact(buyer.email, buyer.firm);
    recordSend();
    recordIntroSentTo(buyer.id);
    return { kind: "ok" };
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }
}

/**
 * Surfaces cold buyers from the book as one-tap re-engagement cards on
 * broker Today. The "cold" signal comes from buyer telemetry the matcher
 * auto-stamps; this turns it into action without manual reminders.
 *
 * Hidden entirely when there are no cold buyers — calm by default.
 */
export function ReengagementSection({
  buyers,
  onBuyersChanged,
}: {
  buyers: Buyer[];
  // Notifies parent when local state changes (intro sent / dismissed) so
  // it can refresh its own copy of the buyer book.
  onBuyersChanged: (next: Buyer[]) => void;
}) {
  const [profile] = useBuyerProfile();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  // Bumped on every send/dismiss so the cold list re-evaluates against the
  // freshly-stamped telemetry without us re-reading every buyer.
  const [bumpTick, setBumpTick] = useState(0);

  const cold = useMemo(
    () => coldBuyers(buyers).slice(0, 5),
    [buyers, bumpTick]
  );

  if (cold.length === 0) return null;

  const setRow = (id: string, s: RowState) =>
    setRowStates((prev) => ({ ...prev, [id]: s }));

  const send = async (buyer: Buyer) => {
    setRow(buyer.id, { kind: "sending" });
    const result = await sendReengage(buyer, profile);
    setRow(buyer.id, result);
    if (result.kind === "ok") {
      // recordIntroSentTo already mutated localStorage; pull the fresh list
      // so the parent's view + matcher loyalty bonus update immediately.
      import("@/lib/buyer-book").then((m) =>
        onBuyersChanged(m.readBuyers())
      );
      setBumpTick((t) => t + 1);
    }
  };

  const skip = (buyer: Buyer) => {
    dismissReengagement(buyer.id);
    setBumpTick((t) => t + 1);
  };

  return (
    <section>
      <header className="mb-3">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
          Re-engage
        </div>
        <h2 className="mt-1 font-semibold text-xl md:text-2xl tracking-tight text-[color:var(--color-fg)]">
          {cold.length} buyer{cold.length === 1 ? "" : "s"} gone quiet
        </h2>
        <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
          Stalest first. One tap sends a check-in — no portfolio needed. Skip to hide for 30 days.
        </p>
      </header>
      <ul className="space-y-2">
        {cold.map((c) => (
          <ColdRow
            key={c.buyer.id}
            cold={c}
            state={rowStates[c.buyer.id] ?? { kind: "idle" }}
            onSend={() => send(c.buyer)}
            onSkip={() => skip(c.buyer)}
          />
        ))}
      </ul>
    </section>
  );
}

function ColdRow({
  cold,
  state,
  onSend,
  onSkip,
}: {
  cold: ColdBuyer;
  state: RowState;
  onSend: () => void;
  onSkip: () => void;
}) {
  const { buyer, daysSinceTouch, reason } = cold;
  const ageLabel =
    reason === "never_contacted"
      ? `in book ${formatAge(daysSinceTouch)} · never contacted`
      : `quiet ${formatAge(daysSinceTouch)}`;
  const loyal = (buyer.dealsClosedCount || 0) > 0;

  return (
    <li className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-3 md:p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[14px] font-medium text-[color:var(--color-fg)]">
              {buyer.firm}
            </span>
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--color-warn)]">
              {ageLabel}
            </span>
            {loyal && (
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--color-success)]">
                ★ loyal · {buyer.dealsClosedCount} closed
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--color-fg-dim)] leading-snug">
            {buyer.contactName && <>{buyer.contactName} · </>}
            {buyer.assetClasses.length > 0
              ? buyer.assetClasses.slice(0, 3).join(", ")
              : "no asset focus saved"}
            {buyer.licensedStates.length > 0 && (
              <> · {buyer.licensedStates.slice(0, 5).join(", ")}</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onSend}
            disabled={state.kind === "sending" || state.kind === "ok"}
            className="btn-primary text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.kind === "sending"
              ? "Sending…"
              : state.kind === "ok"
                ? "Sent ✓"
                : "Send check-in ⚡"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={state.kind === "ok"}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Skip 30d
          </button>
        </div>
      </div>
      {state.kind === "disabled" && (
        <p className="mt-2 text-[11px] text-[color:var(--color-warn)] leading-snug">
          Auto-send is off — set <code className="font-mono">RESEND_API_KEY</code> to enable one-tap re-engagement.
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-2 text-[11px] text-[color:var(--color-danger)]">Send failed: {state.message}</p>
      )}
    </li>
  );
}
