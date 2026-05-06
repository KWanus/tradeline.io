"use client";

import { useEffect, useState } from "react";

type Stage = "sourced" | "reviewing" | "underwriting" | "bidding" | "won" | "lost" | "walked";

type Deal = {
  id: string;
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  askCentsPerDollar?: number;
  bidCentsPerDollar?: number;
  stage: Stage;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STAGES: { id: Stage; label: string; tone: string }[] = [
  { id: "sourced", label: "Sourced", tone: "text-[color:var(--color-fg-faint)]" },
  { id: "reviewing", label: "Reviewing", tone: "text-[color:var(--color-fg-dim)]" },
  { id: "underwriting", label: "Underwriting", tone: "text-[color:var(--color-warn)]" },
  { id: "bidding", label: "Bidding", tone: "text-[color:var(--color-warn)]" },
  { id: "won", label: "Won", tone: "text-[color:var(--color-accent)]" },
  { id: "lost", label: "Lost", tone: "text-[color:var(--color-fg-faint)]" },
  { id: "walked", label: "Walked", tone: "text-[color:var(--color-fg-faint)]" },
];

const STAGE_WEIGHT: Record<Stage, number> = {
  sourced: 0.05,
  reviewing: 0.15,
  underwriting: 0.3,
  bidding: 0.5,
  won: 1.0,
  lost: 0,
  walked: 0,
};

const STORAGE_KEY = "tradeline.pipeline.deals.v1";

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadFromStorage(): Deal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Deal[];
  } catch {
    return [];
  }
}

function saveToStorage(deals: Deal[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

const DEMO_DEALS: Omit<Deal, "id" | "createdAt" | "updatedAt">[] = [
  {
    ticker: "WAL",
    brokerName: "Garnet Capital",
    assetClass: "Credit card",
    faceValueUsd: 12_000_000,
    askCentsPerDollar: 5.5,
    stage: "reviewing",
    notes: "Mid-Atlantic mix. Originator showing 306% YoY charge-off acceleration; broker says fresh tape, full docs.",
  },
  {
    ticker: "FLG",
    brokerName: "RMG Investments",
    assetClass: "Junior mortgage",
    faceValueUsd: 28_500_000,
    askCentsPerDollar: 42,
    bidCentsPerDollar: 38,
    stage: "bidding",
    notes: "Secured paper, 60% LTV avg. Realistic hypothecation candidate after 12 months.",
  },
  {
    ticker: "EWBC",
    brokerName: "NLEX",
    assetClass: "Commercial",
    faceValueUsd: 8_300_000,
    askCentsPerDollar: 4.2,
    bidCentsPerDollar: 3.1,
    stage: "lost",
    notes: "Bid was 26% below ask; winning bidder rumored at 4.0¢. Note for next cycle.",
  },
];

export function PipelineBoard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  useEffect(() => {
    setDeals(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(deals);
  }, [deals, hydrated]);

  const upsert = (d: Deal) => {
    setDeals((prev) => {
      const i = prev.findIndex((x) => x.id === d.id);
      if (i === -1) return [d, ...prev];
      const next = [...prev];
      next[i] = d;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  };

  const remove = (id: string) =>
    setDeals((prev) => prev.filter((d) => d.id !== id));

  const advance = (id: string) =>
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const order: Stage[] = ["sourced", "reviewing", "underwriting", "bidding", "won"];
        const i = order.indexOf(d.stage);
        if (i === -1 || i === order.length - 1) return d;
        return { ...d, stage: order[i + 1], updatedAt: new Date().toISOString() };
      })
    );

  const seedDemo = () => {
    const now = new Date().toISOString();
    setDeals((prev) => [
      ...DEMO_DEALS.map((d) => ({ ...d, id: newId(), createdAt: now, updatedAt: now })),
      ...prev,
    ]);
  };

  const totalFace = deals.reduce((s, d) => s + (d.faceValueUsd || 0), 0);
  const weightedFace = deals.reduce(
    (s, d) => s + (d.faceValueUsd || 0) * STAGE_WEIGHT[d.stage],
    0
  );
  const wonFace = deals
    .filter((d) => d.stage === "won")
    .reduce((s, d) => s + (d.faceValueUsd || 0), 0);

  const grouped: Record<Stage, Deal[]> = {
    sourced: [],
    reviewing: [],
    underwriting: [],
    bidding: [],
    won: [],
    lost: [],
    walked: [],
  };
  for (const d of deals) grouped[d.stage].push(d);

  if (!hydrated) {
    return (
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
        Loading your pipeline…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <Stat label="Open deals" value={deals.filter((d) => !["won","lost","walked"].includes(d.stage)).length} />
        <Stat label="Pipeline face" value={formatUSD(totalFace)} />
        <Stat label="Weighted (by stage)" value={formatUSD(weightedFace)} tone="ok" />
        <Stat label="Won face" value={formatUSD(wonFace)} tone="strong" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          + Add deal
        </button>
        {deals.length === 0 && (
          <button
            type="button"
            onClick={seedDemo}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Load demo deals
          </button>
        )}
        {deals.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all deals from this device?")) setDeals([]);
            }}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Clear all
          </button>
        )}
        <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] ml-auto">
          Saved on this device only
        </span>
      </div>

      {(showForm || editing) && (
        <DealForm
          initial={editing}
          onSave={upsert}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {deals.length === 0 ? (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-12 text-center text-[color:var(--color-fg-dim)]">
          <p className="text-[16px] text-[color:var(--color-fg)]">No deals tracked yet.</p>
          <p className="mt-2 text-[14px]">
            Click <em>Add deal</em> to start, or load 3 demo deals to see how it works.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {STAGES.map((s) => {
            const list = grouped[s.id];
            if (list.length === 0) return null;
            return (
              <section key={s.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`font-mono text-[11px] tracking-[0.25em] uppercase ${s.tone}`}>
                    {s.label} <span className="text-[color:var(--color-fg-faint)]">({list.length})</span>
                  </div>
                </div>
                <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] divide-y divide-[color:var(--color-line)]">
                  {list.map((d) => (
                    <DealRow
                      key={d.id}
                      deal={d}
                      onEdit={() => setEditing(d)}
                      onAdvance={() => advance(d.id)}
                      onDelete={() => remove(d.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DealRow({
  deal,
  onEdit,
  onAdvance,
  onDelete,
}: {
  deal: Deal;
  onEdit: () => void;
  onAdvance: () => void;
  onDelete: () => void;
}) {
  const canAdvance = ["sourced", "reviewing", "underwriting", "bidding"].includes(deal.stage);
  return (
    <div className="px-5 py-4 hover:bg-[color:var(--color-bg-2)] transition">
      <div className="flex items-baseline gap-3 flex-wrap">
        {deal.ticker && (
          <span className="font-mono text-[15px] text-[color:var(--color-accent)]">
            {deal.ticker}
          </span>
        )}
        <span className="text-[14px] text-[color:var(--color-fg)]">{deal.brokerName}</span>
        <span className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)]">
          {deal.assetClass}
        </span>
        <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)] tick">
          {formatUSD(deal.faceValueUsd)}
        </span>
        {typeof deal.askCentsPerDollar === "number" && (
          <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
            ask {deal.askCentsPerDollar}¢
          </span>
        )}
        {typeof deal.bidCentsPerDollar === "number" && (
          <span className="font-mono text-[11px] text-[color:var(--color-warn)]">
            bid {deal.bidCentsPerDollar}¢
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canAdvance && (
            <button
              type="button"
              onClick={onAdvance}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              Advance &rarr;
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 border border-[color:var(--color-line)] hover:border-[color:var(--color-fg)] transition"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this deal?")) onDelete();
            }}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Del
          </button>
        </div>
      </div>
      {deal.notes && (
        <div className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">{deal.notes}</div>
      )}
    </div>
  );
}

function DealForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Deal | null;
  onSave: (d: Deal) => void;
  onCancel: () => void;
}) {
  const [ticker, setTicker] = useState(initial?.ticker || "");
  const [brokerName, setBrokerName] = useState(initial?.brokerName || "");
  const [assetClass, setAssetClass] = useState(initial?.assetClass || "Credit card");
  const [faceValueUsd, setFaceValueUsd] = useState(initial?.faceValueUsd?.toString() || "");
  const [ask, setAsk] = useState(initial?.askCentsPerDollar?.toString() || "");
  const [bid, setBid] = useState(initial?.bidCentsPerDollar?.toString() || "");
  const [stage, setStage] = useState<Stage>(initial?.stage || "sourced");
  const [notes, setNotes] = useState(initial?.notes || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const deal: Deal = {
      id: initial?.id || newId(),
      ticker: ticker.trim().toUpperCase(),
      brokerName: brokerName.trim() || "—",
      assetClass: assetClass.trim() || "—",
      faceValueUsd: Number(faceValueUsd) || 0,
      askCentsPerDollar: ask ? Number(ask) : undefined,
      bidCentsPerDollar: bid ? Number(bid) : undefined,
      stage,
      notes: notes.trim(),
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    };
    onSave(deal);
  };

  return (
    <form
      onSubmit={submit}
      className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6"
    >
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-4">
        {initial ? "Edit deal" : "New deal"}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Ticker (originator)" value={ticker} onChange={setTicker} placeholder="e.g. WAL" />
        <Input label="Broker" value={brokerName} onChange={setBrokerName} placeholder="e.g. Garnet Capital" />
        <Select
          label="Asset class"
          value={assetClass}
          onChange={setAssetClass}
          options={["Credit card", "Auto", "Junior mortgage", "Medical", "Commercial", "Specialty"]}
        />
        <Select
          label="Stage"
          value={stage}
          onChange={(v) => setStage(v as Stage)}
          options={STAGES.map((s) => s.id)}
        />
        <Input
          label="Face value (USD)"
          value={faceValueUsd}
          onChange={setFaceValueUsd}
          placeholder="5000000"
          type="number"
        />
        <Input
          label="Ask (¢ / $)"
          value={ask}
          onChange={setAsk}
          placeholder="5.0"
          type="number"
        />
        <Input
          label="Your bid (¢ / $)"
          value={bid}
          onChange={setBid}
          placeholder="3.5"
          type="number"
        />
      </div>
      <div className="mt-4">
        <label className="block font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Originator context, broker comments, decisions to revisit…"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          {initial ? "Save" : "Add deal"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "strong" | "default";
}) {
  const color =
    tone === "strong"
      ? "text-[color:var(--color-accent)]"
      : tone === "ok"
      ? "text-[color:var(--color-fg)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
    </div>
  );
}
