import { readSnapshot, EMPTY_SNAPSHOT, type RadarSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";
import { WelcomeWizard } from "./_wizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WelcomePage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}

  const strong = snap.originators
    .filter((o) => statusFor(o) === "strong")
    .slice(0, 6)
    .map((o) => {
      const sig = topSignalFor(o.ticker, snap.top_signals);
      return {
        ticker: o.ticker,
        name: o.name || o.ticker,
        tier: o.tier || "",
        signalLabel: sig ? plainSignal(sig.signal_type).label : "Filing activity",
        signalAction: sig ? plainSignal(sig.signal_type).action : "Open the bank page for details.",
        yoyPct: typeof sig?.yoy_pct === "number" ? sig.yoy_pct : null,
        newsMentions: o.news_mentions,
      };
    });

  return <WelcomeWizard strongBanks={strong} />;
}
