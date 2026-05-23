"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUYBACK_REASONS,
  CLOSING_STEPS,
  type Buyback,
  type Closing,
  closingFor,
  completedCount,
  emptyClosing,
  isClosed,
  readClosings,
  writeClosings,
} from "@/lib/closings";

const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

type WonDeal = {
  id: string;
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function readWonDeals(): WonDeal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIPELINE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => d && d.stage === "won")
      .map((d) => ({
        id: String(d.id),
        ticker: String(d.ticker || ""),
        brokerName: String(d.brokerName || ""),
        assetClass: String(d.assetClass || ""),
        faceValueUsd: Number(d.faceValueUsd) || 0,
      }));
  } catch {
    return [];
  }
}

export function ClosingKit() {
  const [deals, setDeals] = useState<WonDeal[]>([]);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDeals(readWonDeals());
    setClosings(readClosings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeClosings(closings);
  }, [closings, hydrated]);

  const mutate = (dealId: string, fn: (c: Closing) => Closing) => {
    setClosings((prev) => {
      const base =
        prev.find((c) => c.dealId === dealId) || emptyClosing(dealId);
      return [...prev.filter((c) => c.dealId !== dealId), fn(base)];
    });
  };

  if (!hydrated) return null;
  if (deals.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-[color:var(--color-success)]">
        Close kit
      </div>
      <h2 className="mt-2 font-serif text-3xl md:text-4xl tracking-tight text-[color:var(--color-fg)]">
        Won the bid? Now actually close it.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
        A &ldquo;Won&rdquo; deal isn&rsquo;t done. Work each closing step,
        capture the wire instructions somewhere you&rsquo;ll find them, and log
        every account the seller takes back.
      </p>

      <div className="mt-5 space-y-4">
        {deals.map((deal) => (
          <ClosingCard
            key={deal.id}
            deal={deal}
            closing={closingFor(deal.id, closings)}
            mutate={(fn) => mutate(deal.id, fn)}
          />
        ))}
      </div>
    </section>
  );
}

function ClosingCard({
  deal,
  closing,
  mutate,
}: {
  deal: WonDeal;
  closing: Closing;
  mutate: (fn: (c: Closing) => Closing) => void;
}) {
  const done = completedCount(closing);
  const closed = isClosed(closing);
  const [bbAccount, setBbAccount] = useState("");
  const [bbReason, setBbReason] = useState(BUYBACK_REASONS[0]);
  const [bbDate, setBbDate] = useState("");

  const dealName = useMemo(() => {
    const parts = [deal.ticker, deal.brokerName].filter(Boolean);
    return parts.join(" · ") || "Won deal";
  }, [deal]);

  const toggleStep = (key: keyof Closing["checklist"]) =>
    mutate((c) => ({
      ...c,
      checklist: { ...c.checklist, [key]: !c.checklist[key] },
    }));

  const setWire = (text: string) =>
    mutate((c) => ({ ...c, wireInstructions: text }));

  const addBuyback = () => {
    if (!bbAccount.trim()) return;
    const entry: Buyback = {
      id: newId(),
      account: bbAccount.trim(),
      reason: bbReason,
      date: bbDate || new Date().toISOString().slice(0, 10),
    };
    mutate((c) => ({ ...c, buybacks: [entry, ...c.buybacks] }));
    setBbAccount("");
    setBbDate("");
  };

  const removeBuyback = (id: string) =>
    mutate((c) => ({
      ...c,
      buybacks: c.buybacks.filter((b) => b.id !== id),
    }));

  return (
    <article
      className={`rounded-2xl border p-5 md:p-6 ${
        closed
          ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
          : "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-xl md:text-2xl tracking-tight text-[color:var(--color-fg)]">
            {dealName}
          </h3>
          <div className="mt-0.5 font-mono text-[11px] tracking-wide text-[color:var(--color-fg-faint)]">
            {deal.assetClass || "—"} · face {formatUSD(deal.faceValueUsd)}
          </div>
        </div>
        <span
          className={`font-mono text-[11px] tracking-[0.18em] uppercase ${
            closed
              ? "text-[color:var(--color-success)]"
              : "text-[color:var(--color-accent)]"
          }`}
        >
          {closed ? "Closed ✓" : `${done} / ${CLOSING_STEPS.length}`}
        </span>
      </div>

      {/* Checklist */}
      <ul className="mt-4 space-y-1.5">
        {CLOSING_STEPS.map((step) => {
          const checked = closing.checklist[step.key];
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => toggleStep(step.key)}
                className="flex items-center gap-3 text-left w-full group"
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] transition ${
                    checked
                      ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-[color:var(--color-bg)]"
                      : "border-[color:var(--color-line-strong)] group-hover:border-[color:var(--color-accent)]"
                  }`}
                >
                  {checked ? "✓" : ""}
                </span>
                <span
                  className={`text-[14px] ${
                    checked
                      ? "text-[color:var(--color-fg-dim)] line-through"
                      : "text-[color:var(--color-fg)]"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Wire instructions */}
      <div className="mt-4">
        <label className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
          Wire instructions
        </label>
        <textarea
          rows={2}
          value={closing.wireInstructions}
          onChange={(e) => setWire(e.target.value)}
          placeholder="Receiving bank, ABA, account #, reference — or where the secure doc lives."
          className="w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] resize-y"
        />
      </div>

      {/* Buyback log */}
      <div className="mt-4">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          Buyback log — accounts the seller takes back
        </div>
        {closing.buybacks.length > 0 && (
          <ul className="mb-2 divide-y divide-[color:var(--color-line)] rounded-md border border-[color:var(--color-line)]">
            {closing.buybacks.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 px-3 py-2 text-[13px]"
              >
                <span className="font-mono text-[color:var(--color-fg)]">
                  {b.account}
                </span>
                <span className="text-[color:var(--color-fg-dim)]">
                  {b.reason}
                </span>
                <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
                  {b.date}
                </span>
                <button
                  type="button"
                  onClick={() => removeBuyback(b.id)}
                  className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={bbAccount}
            onChange={(e) => setBbAccount(e.target.value)}
            placeholder="Account # / ID"
            className="flex-1 min-w-[120px] px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)]"
          />
          <select
            value={bbReason}
            onChange={(e) => setBbReason(e.target.value)}
            className="px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)]"
          >
            {BUYBACK_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={bbDate}
            onChange={(e) => setBbDate(e.target.value)}
            className="px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)]"
          />
          <button
            type="button"
            onClick={addBuyback}
            disabled={!bbAccount.trim()}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Log buyback
          </button>
        </div>
      </div>
    </article>
  );
}
