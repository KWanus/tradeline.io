"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readBuyers, recordDealClosedWith, type Buyer } from "@/lib/buyer-book";
import {
  readPortfolios,
  removePortfolio,
  revenueMonthToDate,
  setPortfolioSold,
  setPortfolioStatus,
  type InboundPortfolio,
} from "@/lib/inbound-portfolios";
import { PageHeader } from "../_components/page-header";
import { MatchQueue } from "../broker/_match-queue";
import { ReengagementSection } from "./_reengagement";

/**
 * Broker variant of /app/today. When role=broker the role-gate renders this
 * INSTEAD of the buyer queue. The spine is the match queue (top of page) —
 * adding portfolios/buyers happens on /app/broker so this view stays calm.
 */
export function BrokerToday() {
  const [hydrated, setHydrated] = useState(false);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [portfolios, setPortfolios] = useState<InboundPortfolio[]>([]);

  useEffect(() => {
    setBuyers(readBuyers());
    setPortfolios(readPortfolios());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const activePortfolios = portfolios.filter(
    (p) => p.status === "new" || p.status === "matched"
  );
  const soldCount = portfolios.filter((p) => p.status === "sold").length;
  const revenueMtd = revenueMonthToDate(portfolios);

  const tagline =
    activePortfolios.length > 0
      ? `${activePortfolios.length} portfolio${activePortfolios.length === 1 ? "" : "s"} waiting for intros · ${buyers.length} buyer${buyers.length === 1 ? "" : "s"} in your book.`
      : buyers.length > 0
        ? `Inbox zero. ${buyers.length} buyer${buyers.length === 1 ? "" : "s"} in your book — log a portfolio to fire the matcher.`
        : "Activate your broker workbench to seed your book and start matching.";

  return (
    <div className="space-y-10">
      <PageHeader
        icon={<span aria-hidden>⇄</span>}
        title="Today"
        badge={{ label: "Broker", tone: "primary" }}
        tagline={tagline}
      />

      <BrokerSummary
        portfolioCount={activePortfolios.length}
        buyerCount={buyers.length}
        soldCount={soldCount}
        revenueMtd={revenueMtd}
      />

      <ReengagementSection buyers={buyers} onBuyersChanged={setBuyers} />

      <MatchQueue
        portfolios={activePortfolios}
        buyers={buyers}
        onPortfolioStatus={(id, status) => setPortfolios(setPortfolioStatus(id, status))}
        onPortfolioSold={(id, commission, buyerId) => {
          setPortfolios(setPortfolioSold(id, commission, buyerId));
          if (buyerId) {
            setBuyers(recordDealClosedWith(buyerId, commission));
          }
        }}
        onPortfolioRemove={(id) => setPortfolios(removePortfolio(id))}
        emptyHint={
          <>
            No portfolios in your inbox yet.{" "}
            <Link
              href={"/app/broker" as never}
              className="text-[color:var(--color-accent)] underline"
            >
              Log one
            </Link>{" "}
            and the matcher ranks your book against it instantly.
          </>
        }
      />

      <div className="rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Manage book & portfolios
          </div>
          <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] max-w-xl">
            The full broker workbench — add inbound portfolios, edit your buyer book, switch back to buyer mode.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={"/app/broker/ledger" as never}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-success-dim)] text-[color:var(--color-success)] hover:bg-[color:var(--color-success-soft)] transition"
          >
            $ Ledger
          </Link>
          <Link
            href={"/app/broker" as never}
            className="btn-primary text-[13px]"
          >
            Open broker workbench →
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatRevenue(n: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function BrokerSummary({
  portfolioCount,
  buyerCount,
  soldCount,
  revenueMtd,
}: {
  portfolioCount: number;
  buyerCount: number;
  soldCount: number;
  revenueMtd: number;
}) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Portfolios to match" value={String(portfolioCount)} tone="accent" />
      <Stat label="Buyers in book" value={String(buyerCount)} tone="neutral" />
      <Stat label="Deals closed" value={String(soldCount)} tone="success" />
      <Stat label="Revenue MTD" value={formatRevenue(revenueMtd)} tone="success" />
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
      <div className={`mt-2 font-semibold text-3xl md:text-4xl tracking-tight ${toneColor}`}>
        {value}
      </div>
    </div>
  );
}
