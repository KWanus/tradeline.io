import "server-only";
import type { RadarSnapshot } from "@/lib/snapshot";
import type { Lifts } from "@/lib/autopilot/pattern-performance";
import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";
import {
  enrichSecOriginator,
  enrichSignal,
  formatUsdShort,
  humanAssetClass,
  signalFitScore,
  stateRiskNote,
} from "@/lib/signal-enrichment";
import type { Proposal } from "./_approval-inbox";

export function buildProposals(snap: RadarSnapshot, lifts?: Lifts): Proposal[] {
  const proposals: Proposal[] = [];

  const strong = snap.originators.filter((o) => statusFor(o) === "strong");
  const watching = snap.originators.filter((o) => statusFor(o) === "watching");

  for (const o of strong.slice(0, 3)) {
    const sig = topSignalFor(o.ticker, snap.top_signals);
    const signalCopy = sig ? plainSignal(sig.signal_type) : null;
    const headline = signalCopy?.label || "Filing activity flagged";
    const bankLabel = o.name || o.ticker;
    const secEnriched = enrichSecOriginator(o);
    const tapeLine = `Estimated annual sellable volume: ${secEnriched.rangeLabel}.`;
    const panelLine = secEnriched.panelOnly
      ? `GSIB tier — they sell to pre-approved panel buyers only, so direct outreach rarely lands a first deal. Use this as relationship-build context, not a primary target.`
      : "";
    const brokerLine =
      secEnriched.suggestedBrokers.length > 0
        ? `Best-fit brokers for ${o.tier || "regional"} tier${
            o.asset_class_focus && o.asset_class_focus !== "multi"
              ? ` and ${o.asset_class_focus} focus`
              : ""
          }: ${secEnriched.suggestedBrokers.map((b) => b.shortName).join(", ")}.`
        : "";
    const enrichedBody = [
      `${o.ticker} (${bankLabel}) is showing strong-signal distress — ${headline.toLowerCase()}.`,
      tapeLine,
      brokerLine,
      panelLine,
      `Get ahead of the broker rotation: ping a contact now so you're in the bid stack when paper hits the market.`,
    ]
      .filter(Boolean)
      .join(" ");
    proposals.push({
      id: `outreach-${o.ticker}-${o.last_filed_at || "now"}`,
      group: "outreach",
      title: `Tape inquiry to broker network — ${o.ticker}`,
      subtitle: `${bankLabel} · ${headline} · ${o.tier || "regional"}${
        secEnriched.panelOnly ? " · panel-only" : ""
      }`,
      body: enrichedBody,
      action: "send-email",
      bankName: bankLabel,
      bankKey: o.ticker,
      subject: `Q on any ${o.ticker} paper in your inventory`,
      draft:
        `Hi,\n\n` +
        `Saw ${bankLabel} (${o.ticker}) flag a ${headline.toLowerCase()} on our radar this week. If you're seeing any of their portfolio come up for sale — cards, consumer, auto, anything — I'd appreciate being on the inquiry list before it goes wide.\n\n` +
        `Our shop: [FIRM], a [STATE]-licensed debt buyer focused on [ASSET_FOCUS]. Average ticket [TICKET], servicing through [SERVICER]. Happy to start with a small tape to build the file.\n\n` +
        `Best,\n[YOUR_NAME]\n[FIRM]\n[PHONE] · [EMAIL]`,
      primary: {
        label: "Bank page",
        href: `/app/banks/${o.ticker}`,
      },
      meta: secEnriched.panelOnly ? "Panel-only" : `${o.tier || "regional"}`,
    });
  }

  const fdicSignals = snap.fdic_signals || [];
  const fdicByCert = new Map<string, (typeof fdicSignals)[number]>();
  for (const s of fdicSignals) {
    const existing = fdicByCert.get(s.cert);
    if (!existing) {
      fdicByCert.set(s.cert, s);
      continue;
    }
    if (s.confidence > existing.confidence) {
      fdicByCert.set(s.cert, s);
      continue;
    }
    // Tie on confidence — prefer the charge-off signal (richer payload).
    if (
      s.confidence === existing.confidence &&
      s.signal_type === "charge_off_increase" &&
      existing.signal_type !== "charge_off_increase"
    ) {
      fdicByCert.set(s.cert, s);
    }
  }
  const topCommunityBanks = Array.from(fdicByCert.values())
    .sort(
      (a, b) =>
        signalFitScore(b, { audience: "fdic", lifts }) -
        signalFitScore(a, { audience: "fdic", lifts })
    )
    .slice(0, 3);

  for (const s of topCommunityBanks) {
    const signalText =
      s.signal_type === "charge_off_increase"
        ? "net charge-offs accelerating"
        : "noncurrent loans rising";
    const enriched = enrichSignal(s);
    const tapeLine = enriched.estimatedAnnualSellableFaceUsd
      ? `Est. annual sellable face: ~${formatUsdShort(enriched.estimatedAnnualSellableFaceUsd)} (${
          enriched.tapeSizeLabel
        }).`
      : "";
    const mixLine =
      enriched.dominantAssetClass && enriched.dominantAssetShare
        ? `Charge-off mix: mostly ${humanAssetClass(
            enriched.dominantAssetClass
          )} (${Math.round(enriched.dominantAssetShare * 100)}% of the breakdown).`
        : "";
    const brokerLine =
      enriched.suggestedBrokers.length > 0
        ? `Best-fit brokers for this tier${
            enriched.dominantAssetClass
              ? ` and asset mix`
              : ""
          }: ${enriched.suggestedBrokers
            .map((b) => b.shortName)
            .join(", ")} — relationship-driven, not panel-only.`
        : "";
    const riskLine = stateRiskNote(s.state);
    const enrichedBody = [
      `${s.originator_name} (${s.state}) flagged on its FDIC Call Report — ${signalText}.`,
      mixLine,
      tapeLine,
      brokerLine,
      riskLine,
      `Small FDIC-insured banks like this sell smaller tapes, face far less buyer competition, and often sell direct. Reach the bank's special-assets / loan-workout group before they pick a broker.`,
    ]
      .filter(Boolean)
      .join(" ");
    proposals.push({
      id: `outreach-fdic-${s.cert}-${s.period_end}`,
      group: "outreach",
      title: `Community bank — ${s.originator_name}`,
      subtitle: `${s.state} · ${signalText} ${
        s.yoy_pct > 0 ? "+" : ""
      }${s.yoy_pct.toFixed(0)}% YoY · ${s.period_label}${
        enriched.estimatedAnnualSellableFaceUsd
          ? ` · est. ~${formatUsdShort(enriched.estimatedAnnualSellableFaceUsd)}/yr sellable`
          : ""
      }`,
      body: enrichedBody,
      action: "send-email",
      bankName: s.originator_name,
      bankKey: `fdic-${s.cert}`,
      state: s.state,
      subject: `Buyer inquiry — charged-off consumer paper`,
      draft:
        `Hi,\n\n` +
        `I'm reaching out to ${s.originator_name}'s special-assets / loan-workout team. I'm a [STATE]-licensed debt buyer focused on [ASSET_FOCUS], and I work with banks clearing charged-off consumer accounts off their books.\n\n` +
        `If your team sells charged-off paper directly — or works through a broker who does — I'd like to be considered for your inquiry list. We buy small tapes, close clean (wire on contract execution), and run recoveries through [SERVICER].\n\n` +
        `Happy to send our license, surety bond, and a one-page buyer profile. Who's the right person to talk to?\n\n` +
        `Best,\n[YOUR_NAME]\n[FIRM]\n[PHONE] · [EMAIL]`,
      primary: {
        label: "FDIC BankFind",
        href: s.url,
      },
      meta: enriched.tapeSize
        ? `${enriched.tapeSize === "small" ? "Small" : enriched.tapeSize === "mid" ? "Mid" : enriched.tapeSize === "large" ? "Large" : "XL"} tape`
        : "Low competition",
    });
  }

  const ncuaSignals = snap.ncua_signals || [];
  const ncuaByCert = new Map<string, (typeof ncuaSignals)[number]>();
  for (const s of ncuaSignals) {
    const existing = ncuaByCert.get(s.cert);
    if (!existing || s.confidence > existing.confidence) {
      ncuaByCert.set(s.cert, s);
    }
  }
  const topCreditUnions = Array.from(ncuaByCert.values())
    .sort(
      (a, b) =>
        signalFitScore(b, { audience: "ncua", lifts }) -
        signalFitScore(a, { audience: "ncua", lifts })
    )
    .slice(0, 3);

  for (const s of topCreditUnions) {
    const signalText =
      s.signal_type === "charge_off_increase"
        ? "net charge-offs accelerating"
        : "delinquent loans rising";
    const enriched = enrichSignal(s);
    const tapeLine = enriched.estimatedAnnualSellableFaceUsd
      ? `Est. annual sellable face: ~${formatUsdShort(enriched.estimatedAnnualSellableFaceUsd)} (${
          enriched.tapeSizeLabel
        }).`
      : "";
    const brokerLine =
      enriched.suggestedBrokers.length > 0
        ? `Best-fit brokers if you can't go direct: ${enriched.suggestedBrokers
            .map((b) => b.shortName)
            .join(", ")}.`
        : "";
    const riskLine = stateRiskNote(s.state);
    const enrichedBody = [
      `${s.originator_name} (${s.state}) flagged on its NCUA Call Report — ${signalText}.`,
      tapeLine,
      brokerLine,
      riskLine,
      `Credit unions routinely sell charged-off auto loans and card paper, almost nobody competes for that flow, and they sell direct. Reach the collections / lending department.`,
    ]
      .filter(Boolean)
      .join(" ");
    proposals.push({
      id: `outreach-ncua-${s.cert}-${s.period_end}`,
      group: "outreach",
      title: `Credit union — ${s.originator_name}`,
      subtitle: `${s.state} · ${signalText} ${
        s.yoy_pct > 0 ? "+" : ""
      }${s.yoy_pct.toFixed(0)}% YoY · ${s.period_label}${
        enriched.estimatedAnnualSellableFaceUsd
          ? ` · est. ~${formatUsdShort(enriched.estimatedAnnualSellableFaceUsd)}/yr sellable`
          : ""
      }`,
      body: enrichedBody,
      action: "send-email",
      bankName: s.originator_name,
      bankKey: `ncua-${s.cert}`,
      state: s.state,
      subject: `Buyer inquiry — charged-off auto & card paper`,
      draft:
        `Hi,\n\n` +
        `I'm trying to reach ${s.originator_name}'s collections or lending department. I'm a [STATE]-licensed debt buyer focused on [ASSET_FOCUS], and I work with credit unions clearing charged-off auto loans and credit-card accounts off their books.\n\n` +
        `If your credit union sells charged-off paper — directly or through a broker — I'd like to be considered for your buyer list. We take small tapes, close clean (wire on contract execution), and run recoveries through [SERVICER].\n\n` +
        `Happy to send our license, surety bond, and a one-page buyer profile. Who's the right person to talk to?\n\n` +
        `Best,\n[YOUR_NAME]\n[FIRM]\n[PHONE] · [EMAIL]`,
      primary: {
        label: "NCUA profile",
        href: s.url,
      },
      meta: enriched.tapeSize
        ? `${enriched.tapeSize === "small" ? "Small" : enriched.tapeSize === "mid" ? "Mid" : enriched.tapeSize === "large" ? "Large" : "XL"} tape`
        : "Very low competition",
    });
  }

  // Supply intelligence: institutions whose distressed book just cleared
  // (public Call Report proxy — sold or written off), with lead time when we'd
  // flagged them earlier.
  const cb = snap.cleared_books;
  if (cb && cb.count > 0) {
    const top = cb.top[0];
    const leadLine =
      cb.flagged_early > 0
        ? ` ${cb.flagged_early} we&rsquo;d flagged in an earlier quarter${
            cb.median_lead_days ? ` (median ${cb.median_lead_days} days early)` : ""
          }.`
        : "";
    proposals.push({
      id: `radar-cleared-${cb.as_of}`,
      group: "radar",
      title: `${cb.count} institutions cleared their distressed book`,
      subtitle: `Public disposition proxy · as of ${cb.as_of}`,
      body:
        `These flagged banks showed a sharp drop in noncurrent loans — the bad book left the balance sheet (sold or written off).${leadLine} ` +
        `Biggest mover: ${top.originator_name} (${top.state}), −${Math.round(top.drop_pct)}%. ` +
        `A recent clear means they just freed capacity and may be active again — worth a call.`,
      primary: { label: "See cleared books", href: "/app/intel/track-record" },
      meta: cb.flagged_early > 0 ? `${cb.flagged_early} called early` : "Supply moved",
    });
  }

  // Buy-side market pricing: what public debt buyers are paying (cents on the
  // dollar), from their own SEC disclosures. Informs your bid.
  const mp = snap.market_pricing;
  if (mp && mp.market_median_cents != null && mp.buyers.length > 0) {
    const dirText =
      mp.price_direction === "rising"
        ? "rising — buyers are paying up; bid competitively or wait"
        : mp.price_direction === "softening"
          ? "softening — you can bid lower; supply looks ample"
          : "mixed";
    const buyerLine = mp.buyers
      .map((b) => `${b.ticker} ${b.latest_cents}¢`)
      .join(" · ");
    proposals.push({
      id: `bids-market-pricing-${mp.generated_at.slice(0, 10)}`,
      group: "bids",
      title: `Market pricing: ~${mp.market_median_cents}¢ on the dollar`,
      subtitle: `Public buyer disclosures · ${dirText.split(" — ")[0]}`,
      body:
        `What the big public buyers are paying for charged-off paper, from their SEC filings: ${buyerLine}. ` +
        `Direction: ${dirText}. Use it as your anchor when you price a tape — don't overpay a seller above the market multiple for the asset class.`,
      primary: { label: "Pricing detail", href: "/app/intel/track-record" },
      meta: `${mp.market_median_cents}¢ median`,
    });
  }

  if (snap.matched_news.length > 0) {
    const top = snap.matched_news[0];
    const tickers = (top.matched_tickers || []).join(", ");
    proposals.push({
      id: `radar-news-${top.source_id}`,
      group: "radar",
      title: `News hook on ${tickers || "a tracked bank"}`,
      subtitle: top.publisher || "Source pending",
      body: top.title,
      primary: {
        label: "Use this in outreach",
        href: tickers
          ? `/app/banks/${tickers.split(",")[0].trim()}#outreach`
          : "/app/playbook",
      },
      secondary: {
        label: "Open article",
        href: top.link,
      },
      meta: "Fresh",
    });
  }

  if (watching.length >= 3) {
    proposals.push({
      id: `radar-watching-batch-${watching.length}`,
      group: "radar",
      title: `${watching.length} banks on the watchlist`,
      body: `${watching
        .slice(0, 4)
        .map((o) => o.ticker)
        .join(", ")}${
        watching.length > 4 ? ` + ${watching.length - 4} more` : ""
      } are warming up but not yet strong-signal. One nudge to brokers covering this set keeps you top of mind when the signal sharpens.`,
      primary: {
        label: "Open watchlist",
        href: "/app/banks",
      },
      meta: "Low priority",
    });
  }

  proposals.push({
    id: "launch-step-04",
    group: "launch",
    title: "Send the first 20 outreach emails",
    body: "The launch board's final step. Profile-personalized templates are wired across /app/brokers, /app/lenders, /app/servicers. Open one set, click Send on 20 rows.",
    primary: {
      label: "Open launch board",
      href: "/app/launch",
    },
    secondary: {
      label: "Open playbook",
      href: "/app/playbook",
    },
    meta: "~60 min",
  });

  return proposals;
}
