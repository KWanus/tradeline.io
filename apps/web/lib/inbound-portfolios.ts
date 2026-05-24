// Broker's portfolio inbox — every tape they've been offered by a seller.
// localStorage only; matching reads buyer-book.ts to produce intro queue.

const PORTFOLIO_KEY = "tradeline.broker.inbound_portfolios.v1";

export type PortfolioStatus = "new" | "matched" | "sold" | "passed";

export type InboundPortfolio = {
  id: string;
  sellerName: string;
  // Two-letter state. Used by the matcher to filter licensed buyers.
  sellerState: string;
  // Free-text — broker types whatever the seller called it. Matcher does
  // substring compare against buyer.assetClasses.
  assetClass: string;
  // USD face value of the tape. 0 = not yet captured.
  faceValueUsd: number;
  status: PortfolioStatus;
  notes: string;
  addedAt: string;
  // ISO timestamp of last status change — used to age the queue.
  updatedAt: string;
  // USD commission earned when status === "sold". Captured at status change
  // so the ledger / revenue stats can sum without re-prompting later.
  commissionUsd?: number;
  // ID of the buyer from the broker's book who bought this tape. Captured
  // at Sold so the per-buyer relationship stats accumulate automatically.
  // Optional — broker may sell to someone outside their book.
  boughtByBuyerId?: string;
};

function read(): InboundPortfolio[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InboundPortfolio[]) : [];
  } catch {
    return [];
  }
}

function write(list: InboundPortfolio[]): InboundPortfolio[] {
  if (typeof window === "undefined") return list;
  try {
    window.localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export function readPortfolios(): InboundPortfolio[] {
  return read();
}

export function addPortfolio(
  input: Omit<InboundPortfolio, "id" | "addedAt" | "updatedAt" | "status"> & {
    status?: PortfolioStatus;
  }
): InboundPortfolio[] {
  const now = new Date().toISOString();
  const p: InboundPortfolio = {
    ...input,
    status: input.status ?? "new",
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    addedAt: now,
    updatedAt: now,
  };
  return write([p, ...read()]);
}

export function setPortfolioStatus(
  id: string,
  status: PortfolioStatus
): InboundPortfolio[] {
  return write(
    read().map((p) =>
      p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
    )
  );
}

// Convenience for the Sold transition — sets status AND captures commission
// + optional buyer attribution in one write so the ledger has the $ and the
// per-buyer relationship stats accumulate at the moment the broker says
// "won." The caller is responsible for then calling recordDealClosedWith.
export function setPortfolioSold(
  id: string,
  commissionUsd: number,
  boughtByBuyerId?: string
): InboundPortfolio[] {
  return write(
    read().map((p) =>
      p.id === id
        ? {
            ...p,
            status: "sold",
            commissionUsd: Number.isFinite(commissionUsd) && commissionUsd > 0
              ? commissionUsd
              : p.commissionUsd,
            boughtByBuyerId: boughtByBuyerId || p.boughtByBuyerId,
            updatedAt: new Date().toISOString(),
          }
        : p
    )
  );
}

// MTD revenue across all sold portfolios. Calendar-month based, in the
// browser's local timezone — same boundary the broker thinks in.
export function revenueMonthToDate(
  portfolios?: InboundPortfolio[],
  now: Date = new Date()
): number {
  const list = portfolios ?? read();
  const year = now.getFullYear();
  const month = now.getMonth();
  let total = 0;
  for (const p of list) {
    if (p.status !== "sold") continue;
    if (!p.commissionUsd) continue;
    const t = new Date(p.updatedAt);
    if (Number.isNaN(t.getTime())) continue;
    if (t.getFullYear() === year && t.getMonth() === month) {
      total += p.commissionUsd;
    }
  }
  return total;
}

export function removePortfolio(id: string): InboundPortfolio[] {
  return write(read().filter((p) => p.id !== id));
}
