import { PageIntro } from "../_components/page-intro";
import { CapitalAllocationCalculator } from "./_calculator";

export const dynamic = "force-dynamic";

export default function CapitalPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Workflow"
        title={<>Where the money goes.</>}
        lead={
          <>
            Once your portfolios are paying you, you have to choose: buy more debt,
            borrow against what you have, save for a downturn, or branch out. This
            page shows what experienced operators actually do at each stage.
          </>
        }
        doNow="Move the sliders below to see what split fits where you are right now."
        howThisWorks={
          <>
            <p>
              New buyers usually have one plan: <em>buy more debt</em>. That works
              the first year. After that it gets risky — too many eggs in one
              basket, no rainy-day fund, no leverage. So you split your cash.
            </p>
            <p>
              The calculator below suggests a split based on your stage (just
              starting, growing, established). It&rsquo;s a starting point — not
              financial advice.
            </p>
          </>
        }
      />

      <CapitalAllocationCalculator />
    </main>
  );
}
