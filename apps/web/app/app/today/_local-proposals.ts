"use client";

import { computeBid } from "@/lib/bid-model";
import { readCapitalState } from "@/lib/capital";
import {
  CLOSING_STEPS,
  closingFor,
  completedCount,
  isClosed,
  readClosings,
} from "@/lib/closings";
import {
  collectionsFor,
  hasRemittanceForMonth,
  readCollections,
} from "@/lib/collections";
import {
  CUSTOMER_PLAN_DETAILS,
  loadFromStorage as loadCustomers,
} from "@/lib/customers";
import { planToTier, readPaymentLinks } from "@/lib/billing";
import type { Proposal } from "./_approval-inbox";

const PIPELINE_KEY = "tradeline.pipeline.deals.v1";

type WonDeal = {
  id: string;
  ticker?: string;
  brokerName?: string;
  assetClass?: string;
  stage?: string;
};

type BidableDeal = WonDeal & {
  faceValueUsd?: number;
  bidCentsPerDollar?: number;
};

function formatUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}k`;
  return `$${abs.toFixed(0)}`;
}

/**
 * Client-side proposal generator. The server builds radar/outreach cards from
 * the snapshot; this fills the other half — work that lives in browser
 * localStorage (compliance licenses, owned portfolio) and so can't be seen
 * server-side. Merged into the inbox after hydration.
 */

const COMPLIANCE_KEY = "tradeline.compliance.licenses.v1";
const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";

type License = {
  id: string;
  state: string;
  licenseNumber: string;
  expirationDate: string;
  suretyCarrier: string;
};

type Holding = {
  id: string;
  seller: string;
  servicer: string;
  assetClass: string;
};

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildLocalProposals(): Proposal[] {
  const proposals: Proposal[] = [];

  // Compliance — licenses expiring within 90 days (or already expired).
  for (const l of readJson<License>(COMPLIANCE_KEY)) {
    const days = daysUntil(l.expirationDate);
    if (days > 90) continue;
    const expired = days < 0;
    proposals.push({
      id: `compliance-renew-${l.id}-${l.expirationDate}`,
      group: "compliance",
      title: expired
        ? `${l.state} license EXPIRED — renew immediately`
        : `Renew your ${l.state} license — ${days} days left`,
      subtitle: `License ${l.licenseNumber || "—"} · ${
        l.suretyCarrier || "surety carrier on file"
      }`,
      body: expired
        ? `Your ${l.state} debt-buyer license has expired. You cannot legally buy or hold paper in ${l.state} until it is renewed — contact the state regulator and your surety carrier today.`
        : `Your ${l.state} debt-buyer license expires in ${days} days. Start the renewal now — state processing plus surety-bond paperwork runs weeks, not days.`,
      primary: { label: "Open compliance", href: "/app/compliance" },
      meta: expired ? "Expired" : `${days}d left`,
    });
  }

  // Portfolio — owned tapes with no remittance logged this calendar month.
  const thisMonth = monthKey(new Date());
  const allCollections = readCollections();
  for (const h of readJson<Holding>(PORTFOLIO_KEY)) {
    const hc = collectionsFor(h.id, h.assetClass || "", allCollections);
    if (hasRemittanceForMonth(hc, thisMonth)) continue;
    const assetClass = (h.assetClass || "consumer").toLowerCase();
    proposals.push({
      id: `portfolio-collections-${h.id}-${thisMonth}`,
      group: "portfolio",
      title: `Log this month's collections — ${h.seller || "tape"}`,
      subtitle: `${h.assetClass || "Consumer"} · serviced by ${
        h.servicer || "—"
      }`,
      body: `Your ${assetClass} tape from ${
        h.seller || "this seller"
      } has no remittance logged for ${thisMonth}. Enter the servicer's payment so recovery-vs-model stays accurate and hypothecation timing stays right.`,
      primary: { label: "Open collections tracker", href: "/app/portfolio" },
      meta: "Monthly",
    });
  }

  // Closing — every Won pipeline deal that isn't fully closed out.
  const closings = readClosings();
  for (const d of readJson<WonDeal>(PIPELINE_KEY)) {
    if (d.stage !== "won") continue;
    const closing = closingFor(d.id, closings);
    if (isClosed(closing)) continue;
    const done = completedCount(closing);
    const remaining = CLOSING_STEPS.length - done;
    const dealName =
      [d.ticker, d.brokerName].filter(Boolean).join(" · ") || "Won deal";
    proposals.push({
      id: `closing-${d.id}`,
      group: "closing",
      title: `Close the deal — ${dealName}`,
      subtitle: `${d.assetClass || "Consumer"} · ${done}/${
        CLOSING_STEPS.length
      } closing steps done`,
      body: `You won this bid but the deal isn't done. ${remaining} closing step${
        remaining === 1 ? "" : "s"
      } left — contract, wire, final tape, buyback terms, servicer handoff. Work them in the close kit.`,
      primary: { label: "Open close kit", href: "/app/pipeline" },
      meta: `${remaining} left`,
    });
  }

  // Bids — pipeline deals in Reviewing / Underwriting without a bid yet.
  // The card runs the calculator's NPV model on the deal's face value +
  // asset class and surfaces a disciplined bid number with the math attached.
  for (const d of readJson<BidableDeal>(PIPELINE_KEY)) {
    if (d.stage !== "reviewing" && d.stage !== "underwriting") continue;
    const face = Number(d.faceValueUsd) || 0;
    if (face <= 0) continue;
    // Already has a bid — operator's done the math; don't re-suggest.
    if (Number(d.bidCentsPerDollar) > 0) continue;
    const rec = computeBid(face, d.assetClass || "");
    const dealName =
      [d.ticker, d.brokerName].filter(Boolean).join(" · ") || "deal";
    const calcHref = `/app/tools/bid-calculator?ticker=${encodeURIComponent(
      d.ticker || ""
    )}&broker=${encodeURIComponent(
      d.brokerName || ""
    )}&face=${face}&dealId=${encodeURIComponent(d.id)}`;
    proposals.push({
      id: `bid-${d.id}`,
      group: "bids",
      title: `Bid recommendation — ${dealName}`,
      subtitle: `${
        rec.assetClass
      } · ${formatUSD(face)} face · stage: ${d.stage}`,
      body:
        `Model: ${rec.recoveryPct}% recovery over ${rec.workoutMonths}mo, ` +
        `${rec.servicerFeePct}% servicer fee, ${rec.targetIrrPct}% target IRR. ` +
        `Gross recovery ${formatUSD(rec.grossRecoveryUsd)} → net to buyer ${formatUSD(
          rec.netToBuyerUsd
        )} → max bid ${formatUSD(rec.maxBidUsd)}. ` +
        `Disciplined bid (85% of max, 15% margin): ${formatUSD(
          rec.disciplinedBidUsd
        )} = ${rec.disciplinedCents.toFixed(2)}¢ on the dollar. ` +
        `Open the calculator to tune inputs against tape specifics before sending.`,
      primary: { label: "Open calculator", href: calcHref },
      secondary: { label: "Open pipeline", href: "/app/pipeline" },
      meta: `${rec.disciplinedCents.toFixed(1)}¢`,
    });
  }

  // Capital — flag when owned tapes + live bids exceed total capital.
  const cap = readCapitalState();
  if (cap.configured && cap.available < 0) {
    const shortfall = Math.abs(cap.available);
    // ID buckets by $10k of shortfall so a worsening gap re-alerts even if a
    // prior, smaller warning was already skipped.
    const bucket = Math.ceil(shortfall / 10_000);
    proposals.push({
      id: `capital-overcommit-${bucket}`,
      group: "capital",
      title: `Over-committed by ${formatUSD(shortfall)}`,
      subtitle: `Total ${formatUSD(cap.total)} · deployed ${formatUSD(
        cap.deployed
      )} · committed ${formatUSD(cap.committed)}`,
      body: `Your owned tapes plus live bids exceed your capital. If every open bid is accepted, you cannot fund them all — drop a bid or raise capital before bidding on anything new.`,
      primary: { label: "Open capital tracker", href: "/app/capital" },
      meta: "Capital risk",
    });
  }

  // Customers — trial subscribers nearing trial expiry get a renewal card.
  // Trial length is 14 days; surface a card when ≤4 days remain (or already
  // expired) so the operator has a window to convert before they roll off.
  const TRIAL_LENGTH_DAYS = 14;
  const RENEWAL_WINDOW_DAYS = 4;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const nowMs = Date.now();
  const solo = CUSTOMER_PLAN_DETAILS.solo;
  // A configured Stripe Payment Link (starter tier) lets the renewal draft
  // embed a one-click convert URL instead of "reply and I'll send the link."
  // Operators paste links at /app/billing; /api/billing/payment-link can
  // generate them via the Stripe SDK once STRIPE_SECRET_KEY is set.
  const soloTier = planToTier("solo");
  const soloPayLink = soloTier ? readPaymentLinks()[soloTier] : undefined;
  for (const c of loadCustomers()) {
    if (c.status !== "trial") continue;
    if (!c.startDate) continue;
    const startMs = new Date(c.startDate).getTime();
    if (!Number.isFinite(startMs)) continue;
    const daysIn = Math.floor((nowMs - startMs) / MS_PER_DAY);
    const daysLeft = TRIAL_LENGTH_DAYS - daysIn;
    if (daysLeft > RENEWAL_WINDOW_DAYS) continue;
    const firstName = (c.contactName || "").split(" ")[0] || "there";
    const orgLabel = c.orgName || c.contactName || "Customer";
    const expired = daysLeft <= 0;
    const daysLeftAbs = Math.max(0, daysLeft);
    const subject = expired
      ? `Your Tradeline trial expired — keep the radar running?`
      : `Your Tradeline trial wraps in ${daysLeftAbs} day${
          daysLeftAbs === 1 ? "" : "s"
        }`;
    const draft =
      `Hi ${firstName},\n\n` +
      (expired
        ? `Your Tradeline trial just wrapped. You had two weeks on the full radar — if it was useful, the easiest way to keep going is the ${solo.label} plan at $${solo.mrrUsd}/month. Same access, no contract.\n\n`
        : `Quick note — your Tradeline trial wraps in ${daysLeftAbs} day${
            daysLeftAbs === 1 ? "" : "s"
          }. You've been on it for ${daysIn} days. If the radar and outreach tools have been useful, the ${solo.label} plan at $${solo.mrrUsd}/month covers everything you've been using.\n\n`) +
      (soloPayLink
        ? `Convert here — it's one click: ${soloPayLink}\nHappy to extend the trial or answer any questions before then.\n\n`
        : `Reply and I'll send the Stripe link to convert. Happy to extend the trial or answer any questions before then.\n\n`) +
      `Thanks,\n[YOUR_NAME]\n[FIRM]\n[PHONE] · [EMAIL]`;
    proposals.push({
      id: `customer-renewal-${c.id}`,
      group: "customers",
      title: `Renewal — ${orgLabel}`,
      subtitle: `${
        expired ? "Trial expired" : `${daysLeftAbs}d left`
      } · trial → ${solo.label}`,
      body: `${orgLabel} is on day ${daysIn} of a 14-day trial. ${
        expired
          ? "Trial already expired — convert or they roll off."
          : "Send the renewal email before the window closes."
      }`,
      action: "send-email",
      recipientEmail: c.contactEmail || undefined,
      subject,
      draft,
      primary: { label: "Open customers", href: "/app/customers" },
      ...(soloPayLink
        ? { secondary: { label: "Payment link", href: soloPayLink } }
        : {}),
      meta: expired ? "Expired" : `${daysLeftAbs}d left`,
    });
  }

  return proposals;
}
