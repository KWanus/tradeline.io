"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type InboundPortfolio,
  readPortfolios,
} from "@/lib/inbound-portfolios";

function formatUsd(n: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Bucket = { label: string; deals: number; revenue: number; faceValue: number };

export function Ledger() {
  const [hydrated, setHydrated] = useState(false);
  const [portfolios, setPortfolios] = useState<InboundPortfolio[]>([]);

  useEffect(() => {
    setPortfolios(readPortfolios());
    setHydrated(true);
  }, []);

  const sold = useMemo(
    () =>
      portfolios
        .filter((p) => p.status === "sold")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [portfolios]
  );

  const totals = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    let allTime = 0;
    let ytd = 0;
    let mtd = 0;
    let faceVolume = 0;
    for (const p of sold) {
      const c = p.commissionUsd || 0;
      allTime += c;
      faceVolume += p.faceValueUsd || 0;
      const t = new Date(p.updatedAt);
      if (Number.isNaN(t.getTime())) continue;
      if (t.getFullYear() === thisYear) {
        ytd += c;
        if (t.getMonth() === thisMonth) mtd += c;
      }
    }
    return { allTime, ytd, mtd, faceVolume, count: sold.length };
  }, [sold]);

  const byAssetClass = useMemo(() => bucketBy(sold, (p) => p.assetClass || "—"), [sold]);
  const byState = useMemo(() => bucketBy(sold, (p) => p.sellerState || "—"), [sold]);

  if (!hydrated) return null;

  if (sold.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-10 text-center">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          No closed deals yet
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] max-w-md mx-auto leading-relaxed">
          When you mark a portfolio <strong>Sold</strong> on the broker workbench, you&rsquo;ll be prompted for your commission. Deals land here.
        </p>
        <Link
          href={"/app/broker" as never}
          className="btn-primary text-[13px] mt-6 inline-flex"
        >
          Open broker workbench →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <TotalsRow totals={totals} />

      <section>
        <SectionHeader
          label="By asset class"
          right={
            <button
              type="button"
              onClick={() => downloadCsv(sold)}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              ↓ Export CSV
            </button>
          }
        />
        <BucketTable buckets={byAssetClass} />
      </section>

      <section>
        <SectionHeader label="By state" />
        <BucketTable buckets={byState} />
      </section>

      <section>
        <SectionHeader label={`All ${sold.length} closed deals`} />
        <div className="rounded-xl border border-[color:var(--color-line)] overflow-hidden overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[color:var(--color-bg-soft)]">
              <tr className="text-left font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--color-fg-faint)]">
                <th className="px-4 py-2.5">Closed</th>
                <th className="px-4 py-2.5">Seller</th>
                <th className="px-4 py-2.5">State</th>
                <th className="px-4 py-2.5">Asset</th>
                <th className="px-4 py-2.5 text-right">Face</th>
                <th className="px-4 py-2.5 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-line)]">
              {sold.map((p) => (
                <tr key={p.id} className="text-[color:var(--color-fg)]">
                  <td className="px-4 py-3 text-[color:var(--color-fg-dim)] font-mono text-[11px]">
                    {formatDate(p.updatedAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.sellerName || "—"}</td>
                  <td className="px-4 py-3 text-[color:var(--color-fg-dim)] font-mono text-[11px]">
                    {p.sellerState || "—"}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-fg-dim)]">
                    {p.assetClass || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[11px] text-[color:var(--color-fg-dim)]">
                    {p.faceValueUsd ? formatUsd(p.faceValueUsd) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12px] text-[color:var(--color-success)] font-semibold">
                    {p.commissionUsd ? formatUsd(p.commissionUsd) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function bucketBy(
  list: InboundPortfolio[],
  keyOf: (p: InboundPortfolio) => string
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const p of list) {
    const key = keyOf(p);
    const b = map.get(key) ?? { label: key, deals: 0, revenue: 0, faceValue: 0 };
    b.deals += 1;
    b.revenue += p.commissionUsd || 0;
    b.faceValue += p.faceValueUsd || 0;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

function TotalsRow({
  totals,
}: {
  totals: { allTime: number; ytd: number; mtd: number; faceVolume: number; count: number };
}) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Stat label="Revenue MTD" value={formatUsd(totals.mtd)} tone="success" />
      <Stat label="Revenue YTD" value={formatUsd(totals.ytd)} tone="success" />
      <Stat label="All-time revenue" value={formatUsd(totals.allTime)} tone="accent" />
      <Stat label="Deals closed" value={String(totals.count)} tone="neutral" />
      <Stat label="Face brokered" value={formatUsd(totals.faceVolume)} tone="neutral" />
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "neutral" | "success";
}) {
  const toneColor =
    tone === "accent"
      ? "text-[color:var(--color-accent)]"
      : tone === "success"
        ? "text-[color:var(--color-success)]"
        : "text-[color:var(--color-fg)]";
  return (
    <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4 md:p-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className={`mt-2 font-semibold text-2xl md:text-3xl tracking-tight ${toneColor}`}>
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  right,
}: {
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      {right}
    </div>
  );
}

function BucketTable({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return null;
  return (
    <div className="rounded-xl border border-[color:var(--color-line)] overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-[color:var(--color-bg-soft)]">
          <tr className="text-left font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--color-fg-faint)]">
            <th className="px-4 py-2.5"></th>
            <th className="px-4 py-2.5 text-right">Deals</th>
            <th className="px-4 py-2.5 text-right">Face brokered</th>
            <th className="px-4 py-2.5 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-line)]">
          {buckets.map((b) => (
            <tr key={b.label} className="text-[color:var(--color-fg)]">
              <td className="px-4 py-2.5 font-medium">{b.label}</td>
              <td className="px-4 py-2.5 text-right font-mono text-[11px] text-[color:var(--color-fg-dim)]">
                {b.deals}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-[11px] text-[color:var(--color-fg-dim)]">
                {formatUsd(b.faceValue)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-[12px] text-[color:var(--color-success)] font-semibold">
                {formatUsd(b.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadCsv(sold: InboundPortfolio[]): void {
  const header = [
    "closed_at",
    "seller_name",
    "seller_state",
    "asset_class",
    "face_value_usd",
    "commission_usd",
    "notes",
  ];
  const escape = (s: string): string => {
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const rows = sold.map((p) =>
    [
      p.updatedAt,
      p.sellerName,
      p.sellerState,
      p.assetClass,
      String(p.faceValueUsd || 0),
      String(p.commissionUsd || 0),
      p.notes || "",
    ]
      .map(escape)
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `tradeline-ledger-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
