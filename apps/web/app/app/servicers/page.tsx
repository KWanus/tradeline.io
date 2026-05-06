import { PlaceholderPage } from "../_components/placeholder";

export const dynamic = "force-dynamic";

export default function ServicersPage() {
  return (
    <PlaceholderPage
      scope="Year 2 → 3 · Operations + benchmarks"
      title="Servicers"
      lede="Performance scorecards for third-party debt servicers. Most buyers use 3–5 servicers and have no objective way to compare them. We do."
      becomes={[
        "Directory of US debt servicers (NCB Management, Resurgent, JH Portfolio, Plaza, Velocity, etc.)",
        "Per-servicer collection rates by asset class, vintage, geographic mix",
        "Your panel: which servicers you use, what you’ve sent them, what you’ve gotten back",
        "Automated remittance reconciliation — flag when a servicer’s reports don’t match your ledger",
        "Anonymized industry benchmarks: ‘your servicer’s recovery rate is in the 35th percentile vs the cohort’",
        "Compliance status per servicer — license footprint, FDCPA / Reg F adherence signals",
      ]}
      whenItShips={
        <p>
          Year 2 as your private servicer-management workspace; Year 3 as anonymized industry
          benchmarks once enough customers are sending data. Benchmarks are gated on customer
          density — 50+ Pro-tier customers minimum.
        </p>
      }
      whyItMatters={
        <p>
          Servicer choice is the single biggest determinant of NPL portfolio recovery. Today buyers
          pick servicers based on relationships, not data. When Tradeline becomes the place that
          objectively benchmarks servicers, we’re infrastructure for the entire industry — not a
          single buyer’s tool.
        </p>
      }
      compliance={
        <p>
          Servicer benchmarks are <em>aggregate</em> across all customers; no individual customer’s
          tape or recovery data is ever surfaced to another. Anonymization is enforced at query
          time and audited; the architecture is closer to differential-privacy than simple
          aggregation.
        </p>
      }
    />
  );
}
