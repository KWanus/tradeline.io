"use client";

import { useMemo, useState } from "react";
import { type BuyerProfile, fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";
import {
  type Buyer,
  type Match,
  matchBuyers,
  recordIntroSentTo,
} from "@/lib/buyer-book";
import {
  type InboundPortfolio,
  type PortfolioStatus,
} from "@/lib/inbound-portfolios";
import { DAILY_SEND_CAP, getRemainingToday, recordSend } from "@/lib/daily-sends";
import { addContact } from "@/lib/contacts";

function formatUSD(n: number): string {
  if (!n) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`;
  return `$${abs.toFixed(0)}`;
}

type IntroResult =
  | { kind: "ok" }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

function buildIntroSubject(portfolio: InboundPortfolio): string {
  return `Intro — ${portfolio.sellerName || "fresh tape"} (${portfolio.sellerState || ""} ${portfolio.assetClass || ""})`.trim();
}

function buildIntroBody(
  portfolio: InboundPortfolio,
  match: Match,
  profile: BuyerProfile
): string {
  return fillTemplate(
    [
      `Hi ${match.buyer.contactName || match.buyer.firm},`,
      ``,
      `Quick intro — a seller I broker for is offering a tape that looks like a fit for ${match.buyer.firm}:`,
      ``,
      `· Seller: ${portfolio.sellerName || "(name on call)"}`,
      `· State: ${portfolio.sellerState || "—"}`,
      `· Asset class: ${portfolio.assetClass || "—"}`,
      portfolio.faceValueUsd > 0 ? `· Face value: ${formatUSD(portfolio.faceValueUsd)}` : "",
      portfolio.notes ? `· Notes: ${portfolio.notes}` : "",
      ``,
      `Reasons I thought of you: ${match.reasons.join(", ") || "fits your book"}.`,
      ``,
      `If you want to take a look, reply and I'll loop you in with the seller directly. Standard broker fee, paid out of close.`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
      `[PHONE] · [EMAIL]`,
    ]
      .filter(Boolean)
      .join("\n"),
    profile
  );
}

// Single-source-of-truth send. Used by per-row buttons and the per-portfolio
// bulk-send strip — keeps both paths semantically identical (recipient
// memory, daily-cap counter, recipient added to contacts on success).
async function sendIntro(
  portfolio: InboundPortfolio,
  match: Match,
  profile: BuyerProfile
): Promise<IntroResult> {
  if (!match.buyer.email) {
    return { kind: "error", message: "buyer has no email saved" };
  }
  const subject = buildIntroSubject(portfolio);
  const text = buildIntroBody(portfolio, match, profile);
  try {
    const r = await fetch("/api/send-outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: match.buyer.email,
        subject,
        text,
        replyTo: profile.email || undefined,
        bankKey: `broker-intro-${portfolio.id}-${match.buyer.id}`,
        bankName: portfolio.sellerName,
        state: portfolio.sellerState,
      }),
    });
    const data = await r.json();
    if (data.enabled === false) return { kind: "disabled" };
    if (!r.ok || data.error) {
      return { kind: "error", message: data.error || `HTTP ${r.status}` };
    }
    addContact(match.buyer.email, match.buyer.firm);
    recordSend();
    // Stamp the buyer's relationship counters so the book table + matcher
    // loyalty bonus reflect activity automatically.
    recordIntroSentTo(match.buyer.id);
    return { kind: "ok" };
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }
}

/**
 * Match queue — top of the broker's day. One card per inbound portfolio,
 * each listing top N matching buyers from the broker's book. Used inline
 * on /app/broker and also lifted onto /app/today when role=broker.
 *
 * maxMatchesPerPortfolio defaults to 3; the broker workbench uses 3, the
 * Today summary view uses 3 so they stay visually aligned.
 */
export function MatchQueue({
  portfolios,
  buyers,
  onPortfolioStatus,
  onPortfolioSold,
  onPortfolioRemove,
  emptyHint,
  maxMatchesPerPortfolio = 3,
}: {
  portfolios: InboundPortfolio[];
  buyers: Buyer[];
  onPortfolioStatus: (id: string, status: PortfolioStatus) => void;
  /** Called when the operator marks a portfolio Sold. commissionUsd may be
   * 0 if the broker skipped the prompt — caller decides whether to persist.
   * boughtByBuyerId is set when the broker picks a buyer from their book
   * so the caller can update per-buyer relationship stats. */
  onPortfolioSold?: (
    id: string,
    commissionUsd: number,
    boughtByBuyerId?: string
  ) => void;
  onPortfolioRemove: (id: string) => void;
  emptyHint?: React.ReactNode;
  maxMatchesPerPortfolio?: number;
}) {
  return (
    <section>
      <header className="mb-4">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
          Match queue
        </div>
        <h2 className="mt-1 font-semibold text-2xl md:text-3xl tracking-tight text-[color:var(--color-fg)]">
          {portfolios.length > 0
            ? `${portfolios.length} portfolio${portfolios.length === 1 ? "" : "s"} waiting for intros`
            : "Inbox zero — no portfolios to match"}
        </h2>
        <p className="mt-1.5 text-[13px] text-[color:var(--color-fg-dim)]">
          Top {maxMatchesPerPortfolio} buyer matches per tape, scored by state · asset class · ticket. Tap to fire the intro.
        </p>
      </header>

      {portfolios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-6 text-[13px] text-[color:var(--color-fg-dim)] text-center">
          {emptyHint ??
            "When a seller offers you a tape, log it below — the matcher ranks your book against it instantly."}
        </div>
      ) : (
        <ol className="space-y-4">
          {portfolios.map((p) => (
            <PortfolioCard
              key={p.id}
              portfolio={p}
              buyers={buyers}
              onStatus={onPortfolioStatus}
              onSold={onPortfolioSold}
              onRemove={onPortfolioRemove}
              maxMatches={maxMatchesPerPortfolio}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

type RowState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "disabled" }
  | { kind: "error"; message: string };

function PortfolioCard({
  portfolio,
  buyers,
  onStatus,
  onSold,
  onRemove,
  maxMatches,
}: {
  portfolio: InboundPortfolio;
  buyers: Buyer[];
  onStatus: (id: string, status: PortfolioStatus) => void;
  onSold?: (
    id: string,
    commissionUsd: number,
    boughtByBuyerId?: string
  ) => void;
  onRemove: (id: string) => void;
  maxMatches: number;
}) {
  const [profile] = useBuyerProfile();
  // Per-buyer send state. Lifted from MatchRow so bulk-send can mutate
  // multiple rows in one orchestrated pass and so each row's "Sent ✓"
  // status survives whether it was triggered individually or in bulk.
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const setRowState = (buyerId: string, s: RowState) =>
    setRowStates((prev) => ({ ...prev, [buyerId]: s }));
  // When true, the inline "Mark Sold" form replaces the standard footer.
  const [showSoldForm, setShowSoldForm] = useState(false);

  const matches = useMemo(
    () =>
      matchBuyers(
        {
          sellerState: portfolio.sellerState,
          assetClass: portfolio.assetClass,
          faceValueUsd: portfolio.faceValueUsd,
        },
        buyers
      ).slice(0, maxMatches),
    [portfolio, buyers, maxMatches]
  );

  const sendOne = async (match: Match) => {
    if (!match.buyer.email) {
      setRowState(match.buyer.id, {
        kind: "error",
        message: "buyer has no email saved",
      });
      return;
    }
    setRowState(match.buyer.id, { kind: "sending" });
    const result = await sendIntro(portfolio, match, profile);
    setRowState(match.buyer.id, result);
  };

  return (
    <li className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-serif text-[20px] md:text-[22px] tracking-tight text-[color:var(--color-fg)] leading-tight">
            {portfolio.sellerName || "Untitled portfolio"}
          </h3>
          <div className="mt-1 font-mono text-[11px] tracking-[0.15em] uppercase text-[color:var(--color-fg-faint)] flex items-center gap-3 flex-wrap">
            {portfolio.sellerState && <span>{portfolio.sellerState}</span>}
            {portfolio.assetClass && <span>{portfolio.assetClass}</span>}
            {portfolio.faceValueUsd > 0 && <span>{formatUSD(portfolio.faceValueUsd)} face</span>}
          </div>
          {portfolio.notes && (
            <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
              {portfolio.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (onSold) {
                setShowSoldForm((v) => !v);
              } else {
                onStatus(portfolio.id, "sold");
              }
            }}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-success-dim)] text-[color:var(--color-success)] hover:bg-[color:var(--color-success-soft)] transition"
          >
            {showSoldForm ? "Cancel" : "★ Sold"}
          </button>
          <button
            type="button"
            onClick={() => onStatus(portfolio.id, "passed")}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-warn)] transition"
          >
            ↷ Pass
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Remove this portfolio?")) onRemove(portfolio.id);
            }}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-danger)] transition"
          >
            Delete
          </button>
        </div>
      </div>

      {showSoldForm && onSold && (
        <MarkSoldForm
          buyers={buyers}
          // Buyers we already sent intros to for THIS portfolio bubble to
          // the top of the picker — they're the most likely actual buyer.
          recentlyContactedIds={Object.entries(rowStates)
            .filter(([, s]) => s.kind === "ok")
            .map(([id]) => id)}
          onCommit={(commissionUsd, buyerId) => {
            onSold(portfolio.id, commissionUsd, buyerId);
            setShowSoldForm(false);
          }}
          onCancel={() => setShowSoldForm(false)}
        />
      )}

      <div className="mt-4">
        {buyers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-4 py-3 text-[12px] text-[color:var(--color-warn)] leading-snug">
            Your buyer book is empty. Add buyers below — the matcher needs your network to suggest intros.
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-4 py-3 text-[12px] text-[color:var(--color-fg-dim)]">
            No matching buyers in your book yet. Add buyers who cover {portfolio.sellerState || "this state"} / {portfolio.assetClass || "this asset class"}.
          </div>
        ) : (
          <>
            <BulkIntroStrip
              portfolio={portfolio}
              matches={matches}
              rowStates={rowStates}
              setRowState={setRowState}
              profile={profile}
            />
            <ul className="space-y-2">
              {matches.map((m) => (
                <MatchRow
                  key={m.buyer.id}
                  match={m}
                  state={rowStates[m.buyer.id] ?? { kind: "idle" }}
                  onSend={() => sendOne(m)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </li>
  );
}

function BulkIntroStrip({
  portfolio,
  matches,
  rowStates,
  setRowState,
  profile,
}: {
  portfolio: InboundPortfolio;
  matches: Match[];
  rowStates: Record<string, RowState>;
  setRowState: (buyerId: string, s: RowState) => void;
  profile: BuyerProfile;
}) {
  const [running, setRunning] = useState(false);

  // "Ready" = has an email AND not already sent/sending. These are what the
  // bulk button will iterate over. Updates whenever rowStates changes so
  // sending one individually then bulking does the right thing.
  const ready = matches.filter((m) => {
    if (!m.buyer.email) return false;
    const s = rowStates[m.buyer.id];
    if (s?.kind === "ok" || s?.kind === "sending") return false;
    return true;
  });
  const missingEmail = matches.filter((m) => !m.buyer.email).length;

  // Don't show the strip if there's only one match to send — the per-row
  // button is already a one-tap action. Strip earns its space at 2+.
  if (matches.length < 2) return null;

  const sendAll = async () => {
    setRunning(true);
    const queue = [...ready];
    for (let i = 0; i < queue.length; i++) {
      if (getRemainingToday() <= 0) break;
      const m = queue[i];
      setRowState(m.buyer.id, { kind: "sending" });
      const result = await sendIntro(portfolio, m, profile);
      setRowState(m.buyer.id, result);
      if (result.kind === "disabled") break;
      // Throttle 1s between sends — matches the BulkSendStrip pattern in
      // approval-inbox, keeps domain reputation healthy.
      if (i < queue.length - 1) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    setRunning(false);
  };

  if (ready.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-soft)] px-4 py-2.5">
      <div className="text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
        <span className="text-[color:var(--color-fg)] font-medium">{ready.length}</span> intro
        {ready.length === 1 ? "" : "s"} ready
        {missingEmail > 0 && (
          <>
            {" · "}
            <span className="text-[color:var(--color-warn)]">{missingEmail}</span> missing email
          </>
        )}
        {" · "}
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          {getRemainingToday()}/{DAILY_SEND_CAP} sends left today
        </span>
      </div>
      <button
        type="button"
        onClick={sendAll}
        disabled={running}
        className="btn-primary text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? "Sending…" : `Send all ${ready.length}`}
      </button>
    </div>
  );
}

function MatchRow({
  match,
  state,
  onSend,
}: {
  match: Match;
  state: RowState;
  onSend: () => void;
}) {
  const fitTone =
    match.score >= 80
      ? "text-[color:var(--color-success)]"
      : match.score >= 60
        ? "text-[color:var(--color-accent)]"
        : "text-[color:var(--color-warn)]";

  return (
    <li className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-3 md:p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[14px] font-medium text-[color:var(--color-fg)]">{match.buyer.firm}</span>
            <span className={`font-mono text-[11px] font-semibold ${fitTone}`}>
              {match.score}% fit
            </span>
            {match.buyer.contactName && (
              <span className="text-[12px] text-[color:var(--color-fg-faint)]">
                · {match.buyer.contactName}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--color-fg-dim)] leading-snug">
            {match.reasons.join(" · ") || "match details unavailable"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onSend}
            disabled={state.kind === "sending" || state.kind === "ok"}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-[12px]"
          >
            {state.kind === "sending"
              ? "Sending…"
              : state.kind === "ok"
                ? "Intro sent ✓"
                : "Send intro ⚡"}
          </button>
        </div>
      </div>
      {state.kind === "disabled" && (
        <p className="mt-2 text-[11px] text-[color:var(--color-warn)] leading-snug">
          Auto-send is off — set <code className="font-mono">RESEND_API_KEY</code> on the server, or copy/paste the draft from /app/today's outreach cards.
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-2 text-[11px] text-[color:var(--color-danger)]">Send failed: {state.message}</p>
      )}
    </li>
  );
}

function MarkSoldForm({
  buyers,
  recentlyContactedIds,
  onCommit,
  onCancel,
}: {
  buyers: Buyer[];
  recentlyContactedIds: string[];
  onCommit: (commissionUsd: number, buyerId?: string) => void;
  onCancel: () => void;
}) {
  const [commission, setCommission] = useState("");
  const [buyerId, setBuyerId] = useState("");

  // Buyers already intro'd for this portfolio first, then everyone else.
  // The "outside the book" option always sits at the bottom.
  const sortedBuyers = [
    ...buyers.filter((b) => recentlyContactedIds.includes(b.id)),
    ...buyers.filter((b) => !recentlyContactedIds.includes(b.id)),
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = Number(commission.replace(/[^0-9.]/g, ""));
    onCommit(
      Number.isFinite(c) ? c : 0,
      buyerId || undefined
    );
  };

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-xl border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] p-4 space-y-3"
    >
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-success)]">
        ★ Mark this portfolio sold
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
            Commission USD
          </div>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            placeholder="42000"
            className="w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          />
        </label>
        <label className="block">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
            Sold to buyer
          </div>
          <select
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          >
            <option value="">— outside the book / unknown —</option>
            {sortedBuyers.map((b) => {
              const sent = recentlyContactedIds.includes(b.id);
              return (
                <option key={b.id} value={b.id}>
                  {sent ? "✦ " : ""}
                  {b.firm}
                  {sent ? " (intro sent)" : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" className="btn-primary text-[12px]">
          ★ Confirm sold
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
        >
          Cancel
        </button>
        <span className="text-[11px] text-[color:var(--color-fg-dim)] leading-snug">
          Stamps the buyer&rsquo;s last-deal date + commission tally automatically.
        </span>
      </div>
    </form>
  );
}
