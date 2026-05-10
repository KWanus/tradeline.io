"use client";

export type DealStage =
  | "sourced"
  | "reviewing"
  | "underwriting"
  | "bidding"
  | "won"
  | "lost"
  | "walked";

export type Deal = {
  id: string;
  ticker: string;
  brokerName: string;
  assetClass: string;
  faceValueUsd: number;
  askCentsPerDollar?: number;
  bidCentsPerDollar?: number;
  stage: DealStage;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function readDeals(): Deal[] {
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

export function writeDeals(deals: Deal[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIPELINE_KEY, JSON.stringify(deals));
  } catch {}
}

export function dealForTicker(ticker: string): Deal | undefined {
  return readDeals().find((d) => d.ticker === ticker);
}

export function upsertDealForBank(args: {
  ticker: string;
  brokerName: string;
  assetClass: string;
  signalNote?: string;
}): Deal {
  const deals = readDeals();
  const now = new Date().toISOString();
  const existing = deals.find((d) => d.ticker === args.ticker);
  if (existing) {
    existing.brokerName = existing.brokerName || args.brokerName;
    existing.assetClass = existing.assetClass || args.assetClass;
    existing.updatedAt = now;
    if (args.signalNote && !existing.notes.includes(args.signalNote)) {
      existing.notes = existing.notes
        ? `${existing.notes}\n\n${args.signalNote}`
        : args.signalNote;
    }
    writeDeals(deals);
    return existing;
  }
  const created: Deal = {
    id: newId(),
    ticker: args.ticker,
    brokerName: args.brokerName,
    assetClass: args.assetClass,
    faceValueUsd: 0,
    stage: "sourced",
    notes: args.signalNote || "",
    createdAt: now,
    updatedAt: now,
  };
  deals.unshift(created);
  writeDeals(deals);
  return created;
}
