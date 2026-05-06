import type { Originator, SecSignal } from "./snapshot";

// Plain-English translation for the signal vocabulary. Used everywhere a
// signal is rendered. Keep adjustments here, not duplicated across pages.

export type SignalCopy = {
  label: string;
  meaning: string;
  action: string;
};

export const SIGNAL_COPY: Record<string, SignalCopy> = {
  charge_off_increase: {
    label: "Loan losses accelerating",
    meaning: "More loans went bad this year than last year.",
    action:
      "Bank likely to package these into a portfolio sale within 1–2 quarters. Watch for broker memos.",
  },
  npl_ratio_increase: {
    label: "Non-performing loans rising",
    meaning: "More borrowers stopped paying than a year ago.",
    action:
      "Bank under pressure — divestiture window typically opens 2–4 quarters out.",
  },
  reserve_build: {
    label: "Bank bracing for more losses",
    meaning: "Setting aside extra money to absorb expected credit losses.",
    action: "Early signal. Tape availability often follows in 2–4 quarters.",
  },
  portfolio_sale_announced: {
    label: "Sale already announced",
    meaning: "Bank officially disclosed a portfolio disposition (8-K item 2.01).",
    action: "Late-stage. Reach out to brokers (NLEX, Garnet, RMG) about access.",
  },
  divestiture_announced: {
    label: "Divestiture event",
    meaning: "Bank announced exiting part of its business.",
    action: "Open the 8-K — which asset class are they exiting?",
  },
  guidance_change: {
    label: "Outlook changed",
    meaning: "Bank revised its forward guidance to investors.",
    action: "Watch follow-on filings for credit-quality detail.",
  },
  unspecified: {
    label: "Quarterly report posted",
    meaning: "Routine 10-Q or 10-K filed; worth a look at MD&A.",
    action: "Open the filing if this bank is on your watch list.",
  },
};

export function plainSignal(type: string): SignalCopy {
  return (
    SIGNAL_COPY[type] || {
      label: type.replace(/_/g, " "),
      meaning: "Signal recorded.",
      action: "Check the source filing for context.",
    }
  );
}

export type Status = "strong" | "watching" | "quiet";

export function statusFor(o: Pick<Originator, "max_confidence" | "signals">): Status {
  if (o.max_confidence >= 0.8 && o.signals > 0) return "strong";
  if (o.max_confidence >= 0.5 && o.signals > 0) return "watching";
  return "quiet";
}

export const STATUS_COPY: Record<Status, { label: string; tone: string }> = {
  strong: {
    label: "Strong signal",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  },
  watching: {
    label: "Worth watching",
    tone: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  },
  quiet: {
    label: "Quiet",
    tone: "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]",
  },
};

export function whyLine(sig?: SecSignal): string {
  if (!sig) return "Filing activity logged but no high-confidence signal yet.";
  if (sig.source === "sec_xbrl" && typeof sig.yoy_pct === "number") {
    const abs = Math.abs(sig.yoy_pct).toFixed(0);
    const dir = sig.yoy_pct >= 0 ? "up" : "down";
    return `${plainSignal(sig.signal_type).meaning} ${dir.charAt(0).toUpperCase() + dir.slice(1)} ${abs}% year-over-year.`;
  }
  if (sig.items && sig.items.length) {
    return `${plainSignal(sig.signal_type).meaning} (8-K item ${sig.items.join(", ")})`;
  }
  return plainSignal(sig.signal_type).meaning;
}

export function relativeAge(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso.slice(0, 10);
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function topSignalFor(ticker: string, signals: SecSignal[]): SecSignal | undefined {
  return signals
    .filter((s) => s.ticker === ticker)
    .sort((a, b) => b.confidence - a.confidence)[0];
}
