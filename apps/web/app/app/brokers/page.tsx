import { PlaceholderPage } from "../_components/placeholder";

export const dynamic = "force-dynamic";

export default function BrokersPage() {
  return (
    <PlaceholderPage
      scope="Phase 2 → 3 · Workflow + ecosystem"
      title="Brokers"
      lede="Every NPL broker, ranked by tape posting cadence, asset class focus, and (eventually) close rate. The CRM and the intelligence layer for the seller side of the market."
      becomes={[
        "Profile per broker (NLEX, Garnet Capital, RMG, IndustryUp, RSI, Kondaur, etc.)",
        "Tape posting cadence — frequency, average size, asset class mix",
        "Your bid history with each broker, your close rate, days to close",
        "Watchlists — get alerted when a broker posts paper that matches your criteria",
        "Reputation score — broker reliability, tape accuracy, post-close behavior",
        "Direct messaging or email-bridge so the workflow stays in Tradeline (Phase 3)",
      ]}
      whenItShips={
        <p>
          Phase 2 as a static directory + your private notes; Phase 3 as a true two-sided product
          where brokers list directly. Forces brokers to either work with us or lose visibility into
          buyer demand — the network-effect lock-in.
        </p>
      }
      whyItMatters={
        <p>
          Today every buyer-broker relationship lives in someone’s inbox. Whoever standardizes how
          tapes are posted and bids are submitted owns the protocol. That’s us. Combined with the
          benchmarks layer (Year 3), brokers can’t afford <em>not</em> to be on Tradeline because
          buyers won’t evaluate paper that isn’t.
        </p>
      }
    />
  );
}
