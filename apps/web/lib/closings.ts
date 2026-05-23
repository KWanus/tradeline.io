"use client";

/**
 * Closing records for Won pipeline deals. A deal moving to "won" means the
 * broker accepted your bid — but the deal isn't done until the contract is
 * signed, funds are wired, the final tape is in hand, buyback terms are
 * confirmed, and a servicer is engaged. This tracks that last mile.
 *
 * Keyed by pipeline deal id. Stored in browser localStorage.
 */

export const CLOSINGS_KEY = "tradeline.closings.v1";

export type ClosingChecklist = {
  contractExecuted: boolean;
  wireSent: boolean;
  finalTapeReceived: boolean;
  buybackTermsAgreed: boolean;
  servicerEngaged: boolean;
};

export type Buyback = {
  id: string;
  account: string;
  reason: string;
  date: string;
};

export type Closing = {
  dealId: string;
  checklist: ClosingChecklist;
  wireInstructions: string;
  buybacks: Buyback[];
};

/** The standard debt-buyer close, in order. */
export const CLOSING_STEPS: { key: keyof ClosingChecklist; label: string }[] = [
  { key: "contractExecuted", label: "Purchase agreement executed" },
  { key: "wireSent", label: "Funds wired on execution" },
  { key: "finalTapeReceived", label: "Final tape received & validated" },
  { key: "buybackTermsAgreed", label: "Buyback terms confirmed in contract" },
  { key: "servicerEngaged", label: "Tape handed to servicer" },
];

/** Standard putback reasons — the seller takes these accounts back. */
export const BUYBACK_REASONS = [
  "Bankruptcy",
  "Deceased",
  "SCRA / military",
  "Identity theft / FCRA",
  "Disputed",
  "Out of statute",
];

export function emptyClosing(dealId: string): Closing {
  return {
    dealId,
    checklist: {
      contractExecuted: false,
      wireSent: false,
      finalTapeReceived: false,
      buybackTermsAgreed: false,
      servicerEngaged: false,
    },
    wireInstructions: "",
    buybacks: [],
  };
}

export function completedCount(c: Closing): number {
  return CLOSING_STEPS.reduce(
    (n, step) => n + (c.checklist[step.key] ? 1 : 0),
    0
  );
}

export function isClosed(c: Closing): boolean {
  return completedCount(c) === CLOSING_STEPS.length;
}

export function readClosings(): Closing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLOSINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Closing[]) : [];
  } catch {
    return [];
  }
}

export function writeClosings(closings: Closing[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLOSINGS_KEY, JSON.stringify(closings));
  } catch {}
}

export function closingFor(dealId: string, closings: Closing[]): Closing {
  return closings.find((c) => c.dealId === dealId) || emptyClosing(dealId);
}
