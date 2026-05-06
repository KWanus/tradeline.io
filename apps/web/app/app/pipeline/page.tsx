import { PlaceholderPage } from "../_components/placeholder";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  return (
    <PlaceholderPage
      scope="Phase 2 · Workflow tier"
      title="Deal pipeline"
      lede="Every tape you’re evaluating, in one place. From first sighting through bid to close — or pass — with the underwriting work attached."
      becomes={[
        "Tapes you’ve received (or are tracking) — broker, asset class, face value, ask price",
        "Stage: Sourced → Reviewing → Underwriting → Bidding → Won / Lost / Walked",
        "Tape evaluation copilot output: portfolio score, originator context, comparable-deal benchmarks",
        "Internal underwriting notes, model assumptions, decision rationale",
        "Bid history per broker (close-rate analytics flow back into Brokers section)",
        "Auto-pull originator XBRL credit-quality data so your underwriting starts with public context",
      ]}
      whenItShips={
        <p>
          Phase 2, after the data product has paying customers and we know the underwriting workflow
          well enough to design for it. The Pro tier ($299/mo) ships with the tape evaluation
          copilot as the wedge.
        </p>
      }
      whyItMatters={
        <p>
          This is the workflow layer that turns Tradeline from “a data feed” into “the place you do
          your job.” Once a buyer’s pipeline lives here, every tape evaluation feeds our benchmarks
          (Phase 3) — the data flywheel that makes us infrastructure.
        </p>
      }
      compliance={
        <p>
          Pipeline rows reference tape <em>aggregates</em>, never individual accounts. If a
          customer uploads a real tape for evaluation, that file lives encrypted in their isolated
          storage scope and is never indexed back into Postgres. The schema in{" "}
          <code className="font-mono text-[12px] text-[color:var(--color-fg)]">docs/schema.sql</code>{" "}
          enforces this in code.
        </p>
      }
    />
  );
}
