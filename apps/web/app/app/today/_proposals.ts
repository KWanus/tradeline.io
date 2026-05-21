import "server-only";
import type { RadarSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";
import type { Proposal } from "./_approval-inbox";

export function buildProposals(snap: RadarSnapshot): Proposal[] {
  const proposals: Proposal[] = [];

  const strong = snap.originators.filter((o) => statusFor(o) === "strong");
  const watching = snap.originators.filter((o) => statusFor(o) === "watching");

  for (const o of strong.slice(0, 3)) {
    const sig = topSignalFor(o.ticker, snap.top_signals);
    const signalCopy = sig ? plainSignal(sig.signal_type) : null;
    const headline = signalCopy?.label || "Filing activity flagged";
    const bankLabel = o.name || o.ticker;
    proposals.push({
      id: `outreach-${o.ticker}-${o.last_filed_at || "now"}`,
      group: "outreach",
      title: `Tape inquiry to broker network — ${o.ticker}`,
      subtitle: `${bankLabel} · ${headline}`,
      body: `${o.ticker} is showing strong-signal distress (${headline.toLowerCase()}). Get ahead of the broker rotation: ping a contact now so you're in the bid stack when paper hits the market.`,
      action: "send-email",
      bankName: bankLabel,
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
      meta: "~2 min",
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
