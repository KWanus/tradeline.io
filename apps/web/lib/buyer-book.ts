// The broker's CRM of debt buyers. Pure localStorage — same pattern as
// lib/contacts.ts, lib/bank-contacts.ts. No server roundtrip required so
// the broker can build their book offline and matching is instant.

const BOOK_KEY = "tradeline.broker.buyer_book.v1";

export type Buyer = {
  id: string;
  firm: string;
  contactName: string;
  email: string;
  // Two-letter codes (e.g. "NC", "VA"). Matching is permissive: empty list
  // means "we don't know yet" rather than "licensed nowhere," so we match
  // it as a fallback rather than excluding the buyer.
  licensedStates: string[];
  // Free-text tags the broker types in: "consumer credit card",
  // "auto deficiency", "medical", etc. Match is case-insensitive substring.
  assetClasses: string[];
  // USD. 0 = unknown. Match treats 0 as "no ceiling/floor."
  ticketMinUsd: number;
  ticketMaxUsd: number;
  // ISO date. Drives the "stale buyer" re-engagement card.
  lastDealAt?: string;
  notes: string;
  addedAt: string;

  // ── Relationship telemetry. All optional so old persisted buyers stay
  // valid; readers should treat missing as 0/undefined. Auto-stamped by
  // sendIntro / setPortfolioSold via recordIntroSentTo + recordDealClosedWith. ──
  introsSent?: number;
  lastIntroAt?: string;
  dealsClosedCount?: number;
  lifetimeCommissionUsd?: number;
};

function read(): Buyer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOOK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Buyer[]) : [];
  } catch {
    return [];
  }
}

function write(buyers: Buyer[]): Buyer[] {
  if (typeof window === "undefined") return buyers;
  try {
    window.localStorage.setItem(BOOK_KEY, JSON.stringify(buyers));
  } catch {}
  return buyers;
}

export function readBuyers(): Buyer[] {
  return read();
}

export function addBuyer(input: Omit<Buyer, "id" | "addedAt">): Buyer[] {
  const buyers = read();
  const buyer: Buyer = {
    ...input,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    addedAt: new Date().toISOString(),
  };
  return write([buyer, ...buyers]);
}

export function updateBuyer(id: string, patch: Partial<Buyer>): Buyer[] {
  return write(read().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

// Fire-and-forget — called from sendIntro on success. Bumps the counter and
// timestamp so the broker's book shows live activity without manual entry.
export function recordIntroSentTo(buyerId: string): Buyer[] {
  const now = new Date().toISOString();
  return write(
    read().map((b) =>
      b.id === buyerId
        ? {
            ...b,
            introsSent: (b.introsSent || 0) + 1,
            lastIntroAt: now,
          }
        : b
    )
  );
}

export type ColdBuyer = {
  buyer: Buyer;
  // Days since the broker last touched this buyer. Used to sort the
  // re-engagement queue (stalest first) and to format the human reason.
  daysSinceTouch: number;
  // "never" if no intro has ever been sent; otherwise the formatted age
  // (e.g. "4mo", "13mo") for display.
  reason: "never_contacted" | "stale";
};

const DISMISSAL_KEY = "tradeline.broker.reengagement_dismissed.v1";
// Dismissals time out after 30 days so a buyer the broker skipped one
// week doesn't vanish forever — re-engagement is a renewable signal.
const DISMISSAL_TTL_MS = 30 * 86_400_000;

type DismissalMap = Record<string, number>; // buyerId -> timestamp ms

function readDismissals(): DismissalMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DISMISSAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // GC any dismissals past TTL so the map doesn't grow without bound.
    const cutoff = Date.now() - DISMISSAL_TTL_MS;
    const fresh: DismissalMap = {};
    for (const [id, ts] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof ts === "number" && ts > cutoff) fresh[id] = ts;
    }
    return fresh;
  } catch {
    return {};
  }
}

export function dismissReengagement(buyerId: string): void {
  if (typeof window === "undefined") return;
  const next = { ...readDismissals(), [buyerId]: Date.now() };
  try {
    window.localStorage.setItem(DISMISSAL_KEY, JSON.stringify(next));
  } catch {}
}

/**
 * Cold buyers worth re-touching. Two flavors:
 *  - "never_contacted": in the book ≥30 days, has an email, no intro ever.
 *  - "stale": last intro ≥90 days ago.
 *
 * Skips buyers without an email (can't reach), and skips ones the broker
 * dismissed in the last 30 days. Sorted stalest-first. Default thresholds
 * tuned for the debt-buying cycle (deals close weekly-to-monthly, so 90d
 * of silence is meaningfully cold).
 */
export function coldBuyers(
  buyers?: Buyer[],
  opts: {
    staleAfterDays?: number;
    neverContactedAfterDays?: number;
    now?: Date;
  } = {}
): ColdBuyer[] {
  const list = buyers ?? read();
  const staleAfter = opts.staleAfterDays ?? 90;
  const neverAfter = opts.neverContactedAfterDays ?? 30;
  const now = (opts.now ?? new Date()).getTime();
  const dismissed = readDismissals();
  const out: ColdBuyer[] = [];

  for (const buyer of list) {
    if (!buyer.email) continue;
    if (dismissed[buyer.id]) continue;

    const sent = buyer.introsSent || 0;
    if (sent === 0) {
      // Never contacted — only show after they've been in the book a
      // minimum dwell so we don't nag the broker the day they import.
      const addedMs = new Date(buyer.addedAt).getTime();
      if (!Number.isFinite(addedMs)) continue;
      const daysInBook = (now - addedMs) / 86_400_000;
      if (daysInBook < neverAfter) continue;
      out.push({
        buyer,
        daysSinceTouch: Math.floor(daysInBook),
        reason: "never_contacted",
      });
    } else {
      const lastMs = buyer.lastIntroAt
        ? new Date(buyer.lastIntroAt).getTime()
        : 0;
      if (!Number.isFinite(lastMs) || lastMs === 0) continue;
      const days = (now - lastMs) / 86_400_000;
      if (days < staleAfter) continue;
      out.push({ buyer, daysSinceTouch: Math.floor(days), reason: "stale" });
    }
  }

  return out.sort((a, b) => b.daysSinceTouch - a.daysSinceTouch);
}

// Called from setPortfolioSold when the operator picks which buyer bought
// the tape. Stamps lastDealAt, increments closed count, and accumulates
// lifetime commission — the three signals that make a buyer "loyal."
export function recordDealClosedWith(
  buyerId: string,
  commissionUsd: number
): Buyer[] {
  const now = new Date().toISOString();
  const add = Number.isFinite(commissionUsd) && commissionUsd > 0
    ? commissionUsd
    : 0;
  return write(
    read().map((b) =>
      b.id === buyerId
        ? {
            ...b,
            lastDealAt: now,
            dealsClosedCount: (b.dealsClosedCount || 0) + 1,
            lifetimeCommissionUsd: (b.lifetimeCommissionUsd || 0) + add,
          }
        : b
    )
  );
}

export function removeBuyer(id: string): Buyer[] {
  return write(read().filter((b) => b.id !== id));
}

// Bulk add — single localStorage write + single render. Used by CSV import
// where calling addBuyer N times would thrash storage. New buyers prepend.
export function addBuyers(
  inputs: Array<Omit<Buyer, "id" | "addedAt">>
): Buyer[] {
  const now = Date.now();
  const fresh: Buyer[] = inputs.map((input, idx) => ({
    ...input,
    // Spread the millis across the batch so ids stay unique even though
    // they're generated in the same tick.
    id: `${(now + idx).toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    addedAt: new Date(now + idx).toISOString(),
  }));
  return write([...fresh, ...read()]);
}

// Seed data for a brand-new broker — five real, publicly-known debt buyers
// shaped like the broker's real book will look. Emails are intentionally
// blank so the broker has to add contact info before sending (matches real
// workflow). State + asset-class data is publicly verifiable via NMLS and
// each firm's website; the broker should still confirm and update.
const STARTER_BUYERS: Array<Omit<Buyer, "id" | "addedAt">> = [
  {
    firm: "Cavalry SPV I, LLC",
    contactName: "",
    email: "",
    licensedStates: ["CA", "NY", "TX", "FL", "NC", "VA", "GA", "IL", "PA", "OH"],
    assetClasses: ["consumer credit card", "consumer loan", "auto deficiency"],
    ticketMinUsd: 250_000,
    ticketMaxUsd: 20_000_000,
    notes: "Starter (replace with your real contact). Large multi-state buyer — check NMLS for current license list before sending.",
  },
  {
    firm: "Jefferson Capital Systems",
    contactName: "",
    email: "",
    licensedStates: ["MN", "TX", "CA", "FL", "NC", "VA", "AZ", "CO", "GA"],
    assetClasses: ["consumer credit card", "telecom", "utility"],
    ticketMinUsd: 100_000,
    ticketMaxUsd: 10_000_000,
    notes: "Starter (replace). MN-based, multi-asset. Long-tenured buyer.",
  },
  {
    firm: "Crown Asset Management",
    contactName: "",
    email: "",
    licensedStates: ["GA", "FL", "NC", "SC", "VA", "TX", "AL", "TN"],
    assetClasses: ["consumer credit card", "consumer loan"],
    ticketMinUsd: 50_000,
    ticketMaxUsd: 5_000_000,
    notes: "Starter (replace). GA-based, southeast focus. Mid-size tickets.",
  },
  {
    firm: "Velocity Investments, LLC",
    contactName: "",
    email: "",
    licensedStates: ["NJ", "NY", "PA", "FL", "NC", "VA", "MA", "CT"],
    assetClasses: ["consumer credit card", "auto deficiency", "private student loan"],
    ticketMinUsd: 50_000,
    ticketMaxUsd: 3_000_000,
    notes: "Starter (replace). NJ-based, northeast + mid-Atlantic.",
  },
  {
    firm: "Resurgent Capital Services",
    contactName: "",
    email: "",
    licensedStates: ["SC", "NC", "GA", "FL", "TX", "CA", "NY", "VA", "AZ", "IL"],
    assetClasses: ["consumer credit card", "consumer loan", "auto deficiency", "medical"],
    ticketMinUsd: 500_000,
    ticketMaxUsd: 50_000_000,
    notes: "Starter (replace). SC-based, large multi-asset. Servicing arm of LVNV.",
  },
];

export function seedStarterBuyers(): Buyer[] {
  const existing = read();
  if (existing.length > 0) return existing;
  // Use the public addBuyer pipeline so each gets a real id + addedAt and
  // the same shape any user-added buyer would have. Order is preserved by
  // adding in reverse — addBuyer prepends.
  let next = existing;
  for (let i = STARTER_BUYERS.length - 1; i >= 0; i--) {
    next = addBuyer(STARTER_BUYERS[i]);
  }
  return next;
}

// Match criteria — used both by the portfolio→buyer matcher and by future
// re-engagement cards. Permissive by design: missing data on the buyer side
// shouldn't drop them out of consideration. The broker is the judge.
export type MatchInput = {
  sellerState?: string;
  assetClass?: string;
  faceValueUsd?: number;
};

export type Match = {
  buyer: Buyer;
  // 0–100. Above 70 = strong fit; 40–70 = worth a try; below = weak.
  score: number;
  // Human reasons the operator can scan in <1s.
  reasons: string[];
};

export function matchBuyers(input: MatchInput, buyers?: Buyer[]): Match[] {
  const list = buyers ?? read();
  const out: Match[] = [];

  for (const buyer of list) {
    let score = 50;
    const reasons: string[] = [];

    // State license — strongest signal. Buyer with no states listed isn't
    // excluded (we just don't know), but doesn't get the bonus either.
    if (input.sellerState && buyer.licensedStates.length > 0) {
      const has = buyer.licensedStates
        .map((s) => s.toUpperCase())
        .includes(input.sellerState.toUpperCase());
      if (has) {
        score += 25;
        reasons.push(`licensed in ${input.sellerState}`);
      } else {
        score -= 35;
        reasons.push(`not licensed in ${input.sellerState}`);
      }
    }

    // Asset class — substring match, both directions, so "consumer credit
    // card" matches buyers who said "credit card" and vice versa.
    if (input.assetClass && buyer.assetClasses.length > 0) {
      const needle = input.assetClass.toLowerCase();
      const hit = buyer.assetClasses.some((c) => {
        const hay = c.toLowerCase();
        return hay.includes(needle) || needle.includes(hay);
      });
      if (hit) {
        score += 20;
        reasons.push(`buys ${input.assetClass}`);
      } else {
        score -= 10;
        reasons.push(`focus mismatch`);
      }
    }

    // Ticket size — only check when the buyer has actually set bounds. 0
    // on either end = unknown, treated as "no ceiling/floor."
    if (input.faceValueUsd && input.faceValueUsd > 0) {
      const min = buyer.ticketMinUsd || 0;
      const max = buyer.ticketMaxUsd || Number.POSITIVE_INFINITY;
      if (input.faceValueUsd >= min && input.faceValueUsd <= max) {
        score += 15;
        reasons.push(`fits ticket range`);
      } else if (input.faceValueUsd < min) {
        score -= 20;
        reasons.push(`below their floor`);
      } else {
        score -= 15;
        reasons.push(`above their ceiling`);
      }
    }

    // Recency — buyers who closed something recently get a small nudge,
    // ones who've gone cold for >180d get a small drag (still surfaced,
    // just ranked lower).
    if (buyer.lastDealAt) {
      const days = (Date.now() - new Date(buyer.lastDealAt).getTime()) / 86_400_000;
      if (Number.isFinite(days)) {
        if (days < 60) score += 5;
        else if (days > 180) score -= 5;
      }
    }

    // Loyalty bonus — buyers who've actually closed paying deals with this
    // broker outrank cold contacts even when raw fit is equal. Capped at
    // +10 so a deep relationship doesn't drown out asset/state mismatches.
    if ((buyer.lifetimeCommissionUsd || 0) > 0) {
      const closed = buyer.dealsClosedCount || 0;
      const bonus = Math.min(10, 3 + closed * 2);
      score += bonus;
      reasons.push(
        closed === 1
          ? "closed 1 prior deal"
          : `closed ${closed} prior deals`
      );
    }

    out.push({
      buyer,
      score: Math.max(0, Math.min(100, Math.round(score))),
      reasons,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
