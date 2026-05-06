import type { Originator, SecSignal } from "./snapshot";
import { plainSignal } from "./signal-copy";

export type TalkingPoint = {
  scenario: string;       // e.g. "Cold-open with broker"
  line: string;           // exact phrasing the user can read
  rationale: string;      // why this works (the persuasion logic)
};

// Build context-aware talking points for a single originator. Inputs come from
// the radar snapshot. Output is meant to be readable mid-conversation.
export function talkingPointsFor(
  o: Originator,
  signals: SecSignal[]
): TalkingPoint[] {
  const top = signals.sort((a, b) => b.confidence - a.confidence)[0];
  const topCopy = top ? plainSignal(top.signal_type) : null;
  const yoyText =
    top && top.source === "sec_xbrl" && typeof top.yoy_pct === "number"
      ? `${top.yoy_pct >= 0 ? "+" : ""}${top.yoy_pct.toFixed(0)}% YoY`
      : null;
  const period = top?.period_label;

  const points: TalkingPoint[] = [];

  if (top && topCopy) {
    points.push({
      scenario: "Cold open with a broker who covers this name",
      line:
        `"I've been watching ${o.ticker} — their ${topCopy.label.toLowerCase()} ${
          yoyText ? `is ${yoyText}` : "is real"
        }${period ? ` as of ${period}` : ""}. ` +
        `If they put paper out, I'd want to be on the look-list. What's been showing up from them lately?"`,
      rationale:
        "Names a specific signal with a specific number. Brokers respect buyers who do their homework — it tells them you'll move fast and won't waste their week with vague tire-kicking.",
    });
  }

  if (top?.signal_type === "charge_off_increase") {
    points.push({
      scenario: "Pitching the bank's own corporate dev / divestiture team",
      line:
        `"I noticed your ${o.ticker} charge-off cohort is accelerating — ${
          yoyText || "materially"
        }. ` +
        `In our experience, banks at this rate are typically evaluating divestiture within 1–2 quarters. ` +
        `If you're considering the secondary market, I'd value a conversation about asset-class fit before you go to a broker."`,
      rationale:
        "Skips the broker layer and goes direct. Works occasionally for smaller regionals; almost never for GSIBs (panel-only). The signal cite is the credibility wedge — they'll wonder how you knew, and they'll take the meeting.",
    });
  }

  if (top?.signal_type === "reserve_build") {
    points.push({
      scenario: "Talking to a co-investor or hypothecation lender",
      line:
        `"${o.ticker} is building reserves ${yoyText || "meaningfully"}. ` +
        `That's the early signal — typically 2–4 quarters before they actually divest. ` +
        `If we position now and have a relationship in place when they're ready, we're first in line."`,
      rationale:
        "Frames the deal as a *timing* play, not a desperation buy. Sophisticated capital partners respond to timing arguments, not 'cheap paper' pitches.",
    });
  }

  if (top?.signal_type === "portfolio_sale_announced" || top?.signal_type === "divestiture_announced") {
    points.push({
      scenario: "Following up after public announcement",
      line:
        `"${o.ticker}'s 8-K disclosed the disposition — items ${(top.items || []).join(", ") || "2.01"}. ` +
        `I assume you have brokers running the process. Whoever's coordinating it, can I get on the bid list? ` +
        `Specifically interested in [your asset class fit]."`,
      rationale:
        "Once it's announced you're competing with everyone, but a fast, specific ask still gets you onto the list. The asset-class specificity is what separates you from the 50 other emails they'll get this week.",
    });
  }

  if (o.news_mentions > 0) {
    points.push({
      scenario: "Conversation with another debt-buyer peer",
      line:
        `"${o.ticker}'s in the press — ${o.news_mentions} matched mention${o.news_mentions === 1 ? "" : "s"} in the last quarter. ` +
        `Market is starting to price in the credit-quality story. If we move before that's fully reflected in their tape ask, we're getting the better entry."`,
      rationale:
        "Peer conversation: you're sharing a thesis, not selling. Building reputation for sharp market reads is itself a long-term close — the next deal someone can't take, they'll send your way.",
    });
  }

  // Generic credibility + closing angles, always relevant
  points.push({
    scenario: "When asked 'why should we deal with you specifically?'",
    line:
      `"Three things. One — we're licensed and bonded in [state] with [bond carrier]; that's table stakes but it's where I lead. ` +
      `Two — we close. Last [N] tapes we touched, we wired on contract date. ` +
      `Three — we're focused. We're not going to buy your ${o.ticker} paper because we want to play; we're going to buy it because the ${
        topCopy?.label?.toLowerCase() || "originator profile"
      } fits our model."`,
    rationale:
      "License + close-rate + focus. The three things every broker actually cares about. Lead with the discipline, not the appetite.",
  });

  if (!top) {
    points.push({
      scenario: "Quiet bank — pre-positioning",
      line:
        `"Watching ${o.ticker} for now — nothing has flagged in their public filings yet, but they're on my radar list. ` +
        `If you start seeing paper from them, I'd want a heads-up before it goes wide."`,
      rationale:
        "Pre-positioning costs nothing and lands you on the broker's mental list. When the signal hits, you're already known.",
    });
  }

  return points;
}
