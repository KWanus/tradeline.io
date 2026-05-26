"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PIPELINE_KEY, type Deal } from "@/lib/pipeline";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

// Mirror of the portfolio board's AssetClass enum. Map free-form Deal
// asset-class strings to one of these so the holding shape stays clean.
type PortfolioAssetClass =
  | "Credit card"
  | "Auto"
  | "Junior mortgage"
  | "Medical"
  | "Commercial"
  | "Tax lien"
  | "Specialty";

const PORTFOLIO_ASSET_CLASSES: PortfolioAssetClass[] = [
  "Credit card",
  "Auto",
  "Junior mortgage",
  "Medical",
  "Commercial",
  "Tax lien",
  "Specialty",
];

function mapAssetClass(s: string | null | undefined): PortfolioAssetClass {
  if (!s) return "Specialty";
  const d = s.toLowerCase();
  if (/credit\s*card|\bcc\b|revolving|charge\s*card|store\s*card|retail\s*card/.test(d))
    return "Credit card";
  if (/auto|vehicle|car\s*loan/.test(d)) return "Auto";
  if (/medical|hospital|healthcare/.test(d)) return "Medical";
  if (/mortgage|home\s*equity|heloc|second\s*lien|junior\s*lien/.test(d)) return "Junior mortgage";
  if (/commercial|business|sba/.test(d)) return "Commercial";
  if (/tax\s*lien/.test(d)) return "Tax lien";
  return "Specialty";
}

type Holding = {
  id: string;
  ticker: string;
  seller: string;
  servicer: string;
  assetClass: PortfolioAssetClass;
  faceValueUsd: number;
  purchasePriceUsd: number;
  vintageYear: number;
  purchaseDate: string;
  performingBalanceUsd?: number;
  cumulativeCollectedUsd?: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

function newId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDeals(): Deal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIPELINE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Deal[]) : [];
  } catch {
    return [];
  }
}

function writeDeals(deals: Deal[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIPELINE_KEY, JSON.stringify(deals));
  } catch {}
}

function readHoldings(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Holding[]) : [];
  } catch {
    return [];
  }
}

function writeHoldings(holdings: Holding[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(holdings));
  } catch {}
}

export function WonDealsPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  function refresh() {
    setDeals(readDeals());
  }

  useEffect(() => {
    refresh();
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === PIPELINE_KEY) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const pending = useMemo(
    () => deals.filter((d) => d.stage === "won" && !d.convertedToHoldingId),
    [deals]
  );

  function convert(input: {
    deal: Deal;
    purchaseDate: string;
    vintageYear: number;
    servicer: string;
    purchasePriceUsd: number;
  }) {
    const now = new Date().toISOString();
    const holding: Holding = {
      id: newId(),
      ticker: input.deal.ticker,
      seller: input.deal.brokerName,
      servicer: input.servicer,
      assetClass: mapAssetClass(input.deal.assetClass),
      faceValueUsd: input.deal.faceValueUsd,
      purchasePriceUsd: input.purchasePriceUsd,
      vintageYear: input.vintageYear,
      purchaseDate: input.purchaseDate,
      notes: `Converted from pipeline deal ${input.deal.id} on ${todayISO()}.${input.deal.notes ? ` Original notes: ${input.deal.notes}` : ""}`,
      createdAt: now,
      updatedAt: now,
    };
    const existingHoldings = readHoldings();
    writeHoldings([holding, ...existingHoldings]);

    const updatedDeals = readDeals().map((d) =>
      d.id === input.deal.id
        ? { ...d, convertedToHoldingId: holding.id, updatedAt: now }
        : d
    );
    writeDeals(updatedDeals);
    setDeals(updatedDeals);
    setExpanded(null);
  }

  if (!hydrated || pending.length === 0) return null;

  return (
    <section className="mb-8">
      <div
        className="rounded-2xl p-6"
        style={{
          background:
            "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
              Won deals · awaiting conversion
            </div>
            <h2 className="mt-1 font-semibold text-2xl tracking-tight text-[color:var(--color-fg)]">
              {pending.length} closed deal{pending.length === 1 ? "" : "s"} not yet in your book
            </h2>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
              You marked these as won in <Link href="/app/pipeline" className="underline hover:text-[color:var(--color-accent)]">/app/pipeline</Link>{" "}
              but haven't added them as holdings. Convert in one click — purchase price + face + asset
              class + ticker all pre-fill from the deal. Add the missing fields (vintage year,
              servicer, purchase date) and it lands in your portfolio so the performance dashboard,
              returns tracker, and capital engine start counting it.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {pending.map((d) => (
            <ConvertCard
              key={d.id}
              deal={d}
              isExpanded={expanded === d.id}
              onExpand={() => setExpanded(d.id)}
              onCancel={() => setExpanded(null)}
              onConvert={convert}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ConvertCard({
  deal,
  isExpanded,
  onExpand,
  onCancel,
  onConvert,
}: {
  deal: Deal;
  isExpanded: boolean;
  onExpand: () => void;
  onCancel: () => void;
  onConvert: (input: {
    deal: Deal;
    purchaseDate: string;
    vintageYear: number;
    servicer: string;
    purchasePriceUsd: number;
  }) => void;
}) {
  const defaultPurchasePrice =
    deal.bidCentsPerDollar !== undefined
      ? deal.faceValueUsd * (deal.bidCentsPerDollar / 100)
      : deal.askCentsPerDollar !== undefined
      ? deal.faceValueUsd * (deal.askCentsPerDollar / 100)
      : 0;
  const defaultCents =
    deal.bidCentsPerDollar ?? deal.askCentsPerDollar ?? null;

  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [vintageYear, setVintageYear] = useState(String(new Date().getFullYear() - 1));
  const [servicer, setServicer] = useState("");
  const [purchasePriceDraft, setPurchasePriceDraft] = useState(
    defaultPurchasePrice > 0 ? String(Math.round(defaultPurchasePrice)) : ""
  );
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const vy = Number(vintageYear);
    const pp = Number(purchasePriceDraft.replace(/[,$\s]/g, ""));
    if (!Number.isFinite(vy) || vy < 1990 || vy > new Date().getFullYear() + 1) {
      setError("Enter a vintage year between 1990 and next year.");
      return;
    }
    if (!Number.isFinite(pp) || pp <= 0) {
      setError("Enter a purchase price > 0.");
      return;
    }
    if (!purchaseDate) {
      setError("Pick a purchase date.");
      return;
    }
    onConvert({
      deal,
      purchaseDate,
      vintageYear: vy,
      servicer: servicer.trim(),
      purchasePriceUsd: pp,
    });
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg)] p-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-mono text-[18px] text-[color:var(--color-accent)] shrink-0">
          {deal.ticker || "—"}
        </span>
        <span className="text-[13px] text-[color:var(--color-fg)] flex-1 truncate min-w-[120px]">
          {deal.brokerName || "—"} · {deal.assetClass || "—"}
        </span>
        <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
          face {fmtUsd(deal.faceValueUsd)}
        </span>
        {defaultCents !== null && (
          <span className="font-mono text-[12px] text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
            bid {defaultCents.toFixed(2)}¢/$ → {fmtUsd(defaultPurchasePrice)}
          </span>
        )}
        {!isExpanded && (
          <button
            type="button"
            onClick={onExpand}
            className="font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            Convert →
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-[color:var(--color-line)] pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FormInput
              label="Purchase date"
              value={purchaseDate}
              onChange={setPurchaseDate}
              type="date"
            />
            <FormInput
              label="Vintage year"
              value={vintageYear}
              onChange={setVintageYear}
              placeholder={String(new Date().getFullYear() - 1)}
              type="number"
            />
            <FormInput
              label="Purchase price (USD)"
              value={purchasePriceDraft}
              onChange={setPurchasePriceDraft}
              placeholder={defaultPurchasePrice > 0 ? String(Math.round(defaultPurchasePrice)) : "0"}
              type="number"
            />
            <FormInput
              label="Servicer"
              value={servicer}
              onChange={setServicer}
              placeholder="e.g. NCB Management"
            />
          </div>
          <div className="text-[11px] text-[color:var(--color-fg-faint)] font-mono">
            Will create a {mapAssetClass(deal.assetClass)} holding. Asset-class is mapped from the
            deal&rsquo;s &ldquo;{deal.assetClass}&rdquo; (override at /app/portfolio after conversion if needed).
          </div>
          {error && (
            <div className="border border-[color:var(--color-danger)] bg-[color:var(--color-bg-1)] p-2 text-[12px] text-[color:var(--color-danger)] rounded">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="font-mono text-xs tracking-[0.2em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-1.5 rounded text-[#0a0c14] hover:opacity-90 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              Create holding
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormInput({
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
      <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

// Re-export the asset class list in case the portfolio board wants to share it
export { PORTFOLIO_ASSET_CLASSES };
