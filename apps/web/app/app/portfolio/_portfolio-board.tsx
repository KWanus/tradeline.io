"use client";

import { useEffect, useMemo, useState } from "react";

type AssetClass = "Credit card" | "Auto" | "Junior mortgage" | "Medical" | "Commercial" | "Tax lien" | "Specialty";

type Holding = {
  id: string;
  ticker: string;            // originator ticker (optional)
  seller: string;            // seller / broker
  servicer: string;          // third-party servicer
  assetClass: AssetClass;
  faceValueUsd: number;      // original face at purchase
  purchasePriceUsd: number;  // what you paid
  vintageYear: number;       // average vintage of accounts (year)
  purchaseDate: string;      // YYYY-MM-DD
  performingBalanceUsd?: number;  // current balance still performing
  cumulativeCollectedUsd?: number; // dollars collected so far
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "tradeline.portfolio.holdings.v1";

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadFromStorage(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Holding[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(holdings: Holding[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function monthsBetween(a: string, b: Date): number {
  const da = new Date(a);
  if (Number.isNaN(da.getTime())) return 0;
  const ms = b.getTime() - da.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 30)));
}

const HYP_THRESHOLDS: Record<AssetClass, { months: number; advanceRatePct: number }> = {
  "Credit card": { months: 12, advanceRatePct: 35 },
  "Auto": { months: 9, advanceRatePct: 50 },
  "Junior mortgage": { months: 12, advanceRatePct: 65 },
  "Medical": { months: 18, advanceRatePct: 25 },
  "Commercial": { months: 12, advanceRatePct: 45 },
  "Tax lien": { months: 6, advanceRatePct: 60 },
  "Specialty": { months: 18, advanceRatePct: 30 },
};

function hypothecationStatus(h: Holding): {
  eligible: boolean;
  monthsSeasoned: number;
  monthsRemaining: number;
  estAdvanceUsd: number;
  thresholdMonths: number;
} {
  const monthsSeasoned = monthsBetween(h.purchaseDate, new Date());
  const t = HYP_THRESHOLDS[h.assetClass];
  const eligible = monthsSeasoned >= t.months;
  const monthsRemaining = Math.max(0, t.months - monthsSeasoned);
  const performing = h.performingBalanceUsd ?? h.faceValueUsd * 0.3; // conservative default
  const estAdvanceUsd = (performing * t.advanceRatePct) / 100;
  return { eligible, monthsSeasoned, monthsRemaining, estAdvanceUsd, thresholdMonths: t.months };
}

const DEMO: Omit<Holding, "id" | "createdAt" | "updatedAt">[] = [
  {
    ticker: "FITB",
    seller: "Fifth Third Bancorp",
    servicer: "NCB Management",
    assetClass: "Credit card",
    faceValueUsd: 8_400_000,
    purchasePriceUsd: 420_000,
    vintageYear: 2024,
    purchaseDate: "2025-03-12",
    performingBalanceUsd: 2_100_000,
    cumulativeCollectedUsd: 285_000,
    notes: "First closed deal. Mid-Atlantic mix. Servicer hitting expectations on month-3 milestones.",
  },
  {
    ticker: "FLG",
    seller: "Flagstar (via RMG)",
    servicer: "Plaza Servicing",
    assetClass: "Junior mortgage",
    faceValueUsd: 12_300_000,
    purchasePriceUsd: 4_650_000,
    vintageYear: 2023,
    purchaseDate: "2024-11-05",
    performingBalanceUsd: 9_800_000,
    cumulativeCollectedUsd: 720_000,
    notes: "Secured. Hypothecation candidate next quarter. Two REOs underway.",
  },
];

export function PortfolioBoard() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);

  useEffect(() => {
    setHoldings(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(holdings);
  }, [holdings, hydrated]);

  const upsert = (h: Holding) => {
    setHoldings((prev) => {
      const i = prev.findIndex((x) => x.id === h.id);
      if (i === -1) return [h, ...prev];
      const next = [...prev];
      next[i] = h;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  };

  const remove = (id: string) =>
    setHoldings((prev) => prev.filter((h) => h.id !== id));

  const seedDemo = () => {
    const now = new Date().toISOString();
    setHoldings((prev) => [
      ...DEMO.map((h) => ({ ...h, id: newId(), createdAt: now, updatedAt: now })),
      ...prev,
    ]);
  };

  const stats = useMemo(() => {
    const totalFace = holdings.reduce((s, h) => s + h.faceValueUsd, 0);
    const totalCost = holdings.reduce((s, h) => s + h.purchasePriceUsd, 0);
    const totalCollected = holdings.reduce(
      (s, h) => s + (h.cumulativeCollectedUsd ?? 0),
      0
    );
    const eligibleHoldings = holdings.filter((h) => hypothecationStatus(h).eligible);
    const totalAdvance = eligibleHoldings.reduce(
      (s, h) => s + hypothecationStatus(h).estAdvanceUsd,
      0
    );
    const blendedSeasoning =
      holdings.length === 0
        ? 0
        : holdings.reduce(
            (s, h) => s + monthsBetween(h.purchaseDate, new Date()),
            0
          ) / holdings.length;
    const blendedCostCents =
      totalFace === 0 ? 0 : (totalCost / totalFace) * 100;
    return {
      totalFace,
      totalCost,
      totalCollected,
      eligibleCount: eligibleHoldings.length,
      totalAdvance,
      blendedSeasoning,
      blendedCostCents,
    };
  }, [holdings]);

  if (!hydrated) {
    return (
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
        Loading your portfolio…
      </div>
    );
  }

  const newlyEligible = holdings.filter((h) => {
    const status = hypothecationStatus(h);
    if (!status.eligible) return false;
    // "newly eligible" = within 2 months of the threshold
    return status.monthsRemaining >= -2;
  });

  return (
    <div className="space-y-8">
      {newlyEligible.length > 0 && (
        <HypothecationReadyStrip holdings={newlyEligible} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <Stat label="Holdings" value={holdings.length} />
        <Stat label="Total face owned" value={formatUSD(stats.totalFace)} />
        <Stat
          label="Cost basis"
          value={formatUSD(stats.totalCost)}
          sub={
            stats.totalFace > 0
              ? `${stats.blendedCostCents.toFixed(2)}¢/$ blended`
              : undefined
          }
          tone="ok"
        />
        <Stat
          label="Collected to date"
          value={formatUSD(stats.totalCollected)}
          sub={
            stats.totalCost > 0
              ? `${((stats.totalCollected / stats.totalCost) * 100).toFixed(0)}% of cost`
              : undefined
          }
          tone="ok"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <Stat
          label="Avg seasoning"
          value={`${stats.blendedSeasoning.toFixed(1)} mo`}
        />
        <Stat
          label="Hypothecation-eligible"
          value={stats.eligibleCount}
          tone={stats.eligibleCount > 0 ? "ok" : "default"}
        />
        <Stat
          label="Est. hypothecation capacity"
          value={formatUSD(stats.totalAdvance)}
          tone={stats.totalAdvance > 0 ? "strong" : "default"}
        />
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
          + Add holding
        </button>
        {holdings.length === 0 && (
          <button
            type="button"
            onClick={seedDemo}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Load demo holdings
          </button>
        )}
        {holdings.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all holdings from this device?")) setHoldings([]);
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
        <HoldingForm
          initial={editing}
          onSave={upsert}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {holdings.length === 0 ? (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-12 text-center text-[color:var(--color-fg-dim)]">
          <p className="text-[16px] text-[color:var(--color-fg)]">
            No portfolios tracked yet.
          </p>
          <p className="mt-2 text-[14px]">
            Click <em>Add holding</em> to record a purchased tape, or load 2 demo
            holdings to see how it works.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {holdings.map((h) => (
            <HoldingRow
              key={h.id}
              holding={h}
              onEdit={() => setEditing(h)}
              onDelete={() => remove(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HoldingRow({
  holding,
  onEdit,
  onDelete,
}: {
  holding: Holding;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hyp = hypothecationStatus(holding);
  const costCentsPerDollar =
    holding.faceValueUsd === 0
      ? 0
      : (holding.purchasePriceUsd / holding.faceValueUsd) * 100;
  return (
    <article className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            {holding.ticker && (
              <span className="font-mono text-xl text-[color:var(--color-accent)]">
                {holding.ticker}
              </span>
            )}
            <span className="text-[15px] text-[color:var(--color-fg)]">
              {holding.seller}
            </span>
            <span className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
              {holding.assetClass}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
            Vintage {holding.vintageYear} · Purchased {holding.purchaseDate} · Servicer {holding.servicer}
          </div>
        </div>
        <span
          className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border rounded ${
            hyp.eligible
              ? "border-[color:var(--color-success-dim)] text-[color:var(--color-success)] bg-[color:var(--color-success-soft)]"
              : "border-[color:var(--color-line-strong)] text-[color:var(--color-fg-faint)]"
          }`}
        >
          {hyp.eligible
            ? `Hypothecation-eligible · ${formatUSD(hyp.estAdvanceUsd)} cap`
            : `Seasoning ${hyp.monthsRemaining}mo to ${hyp.thresholdMonths}mo`}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <SmallStat label="Face" value={formatUSD(holding.faceValueUsd)} />
        <SmallStat
          label="Cost"
          value={formatUSD(holding.purchasePriceUsd)}
          sub={`${costCentsPerDollar.toFixed(2)}¢/$`}
        />
        <SmallStat
          label="Performing"
          value={
            holding.performingBalanceUsd
              ? formatUSD(holding.performingBalanceUsd)
              : "—"
          }
        />
        <SmallStat
          label="Collected"
          value={
            holding.cumulativeCollectedUsd
              ? formatUSD(holding.cumulativeCollectedUsd)
              : "—"
          }
          sub={
            holding.cumulativeCollectedUsd && holding.purchasePriceUsd > 0
              ? `${((holding.cumulativeCollectedUsd / holding.purchasePriceUsd) * 100).toFixed(0)}% of cost`
              : undefined
          }
        />
      </div>
      {holding.notes && (
        <div className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
          {holding.notes}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-fg)] transition"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this holding?")) onDelete();
          }}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
        >
          Del
        </button>
      </div>
    </article>
  );
}

function HoldingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Holding | null;
  onSave: (h: Holding) => void;
  onCancel: () => void;
}) {
  const [ticker, setTicker] = useState(initial?.ticker || "");
  const [seller, setSeller] = useState(initial?.seller || "");
  const [servicer, setServicer] = useState(initial?.servicer || "");
  const [assetClass, setAssetClass] = useState<AssetClass>(initial?.assetClass || "Credit card");
  const [faceValueUsd, setFaceValueUsd] = useState(initial?.faceValueUsd?.toString() || "");
  const [purchasePriceUsd, setPurchasePriceUsd] = useState(initial?.purchasePriceUsd?.toString() || "");
  const [vintageYear, setVintageYear] = useState(initial?.vintageYear?.toString() || "2024");
  const [purchaseDate, setPurchaseDate] = useState(
    initial?.purchaseDate || new Date().toISOString().slice(0, 10)
  );
  const [performingBalanceUsd, setPerformingBalanceUsd] = useState(
    initial?.performingBalanceUsd?.toString() || ""
  );
  const [cumulativeCollectedUsd, setCumulativeCollectedUsd] = useState(
    initial?.cumulativeCollectedUsd?.toString() || ""
  );
  const [notes, setNotes] = useState(initial?.notes || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: initial?.id || newId(),
      ticker: ticker.trim().toUpperCase(),
      seller: seller.trim() || "—",
      servicer: servicer.trim() || "—",
      assetClass,
      faceValueUsd: Number(faceValueUsd) || 0,
      purchasePriceUsd: Number(purchasePriceUsd) || 0,
      vintageYear: Number(vintageYear) || new Date().getFullYear(),
      purchaseDate,
      performingBalanceUsd: performingBalanceUsd ? Number(performingBalanceUsd) : undefined,
      cumulativeCollectedUsd: cumulativeCollectedUsd ? Number(cumulativeCollectedUsd) : undefined,
      notes: notes.trim(),
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6"
    >
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-4">
        {initial ? "Edit holding" : "New holding"}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Ticker (originator)" value={ticker} onChange={setTicker} placeholder="e.g. FITB" />
        <Input label="Seller" value={seller} onChange={setSeller} placeholder="e.g. Fifth Third Bancorp" />
        <Input label="Servicer" value={servicer} onChange={setServicer} placeholder="e.g. NCB Management" />
        <Select
          label="Asset class"
          value={assetClass}
          onChange={(v) => setAssetClass(v as AssetClass)}
          options={["Credit card", "Auto", "Junior mortgage", "Medical", "Commercial", "Tax lien", "Specialty"]}
        />
        <Input
          label="Face value (USD)"
          value={faceValueUsd}
          onChange={setFaceValueUsd}
          placeholder="5000000"
          type="number"
        />
        <Input
          label="Purchase price (USD)"
          value={purchasePriceUsd}
          onChange={setPurchasePriceUsd}
          placeholder="200000"
          type="number"
        />
        <Input
          label="Avg vintage year"
          value={vintageYear}
          onChange={setVintageYear}
          placeholder="2024"
          type="number"
        />
        <Input
          label="Purchase date"
          value={purchaseDate}
          onChange={setPurchaseDate}
          type="date"
        />
        <Input
          label="Current performing balance (optional)"
          value={performingBalanceUsd}
          onChange={setPerformingBalanceUsd}
          placeholder="1500000"
          type="number"
        />
        <Input
          label="Cumulative collected (optional)"
          value={cumulativeCollectedUsd}
          onChange={setCumulativeCollectedUsd}
          placeholder="180000"
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
          placeholder="Servicer performance, hypothecation conversations, REO status…"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          {initial ? "Save" : "Add holding"}
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
  sub,
  tone = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
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
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
          {sub}
        </div>
      )}
    </div>
  );
}

function SmallStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[color:var(--color-bg-1)] p-3">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px] tick text-[color:var(--color-fg)]">
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-[10px] text-[color:var(--color-fg-faint)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function HypothecationReadyStrip({ holdings }: { holdings: Holding[] }) {
  return (
    <div
      className="relative rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase">
            <span
              className="px-2 py-0.5 rounded-full text-[#1a0c00] font-semibold"
              style={{ background: "var(--gradient-primary)" }}
            >
              Hypothecation ready
            </span>
            <span className="text-[color:var(--color-fg-faint)]">
              · {holdings.length} {holdings.length === 1 ? "portfolio" : "portfolios"}
            </span>
          </div>
          <h2 className="mt-1.5 font-serif italic text-xl text-[color:var(--color-fg)]">
            Apply for a loan against these now.
          </h2>
          <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            These portfolios have crossed the seasoning threshold — lenders will advance against them.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {holdings.slice(0, 6).map((h) => {
          const status = hypothecationStatus(h);
          return (
            <div
              key={h.id}
              className="rounded-lg border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[14px] text-[color:var(--color-fg)] truncate">
                  {h.ticker || h.seller}
                </span>
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-success)]">
                  ~{formatUSD(status.estAdvanceUsd)}
                </span>
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
                {h.assetClass} · {monthsBetween(h.purchaseDate, new Date())}mo seasoned
              </div>
              <a
                href="/app/lenders"
                className="mt-2 inline-block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
              >
                See lenders →
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
