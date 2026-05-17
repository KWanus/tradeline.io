import { PageIntro } from "../_components/page-intro";
import { ProgressDashboard } from "./_dashboard";

export const dynamic = "force-dynamic";

export default function ProgressPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Self-review"
        title={<>How the workbase is performing for you.</>}
        lead={
          <>
            One page, every metric. Last 7 days, last 30 days, all time. Open
            this once a week — Sunday night is the right cadence — and you'll
            know if the system is working before your Monday plan.
          </>
        }
        doNow="Below 5 emails sent last week? You're not putting enough at-bats on the board. Below 1 deal in pipeline? You haven't gotten a reply that converted."
        howThisWorks={
          <>
            <p>
              Every action you take in Tradeline writes to localStorage:
              outreach log when you send an email, pipeline writes when you
              advance a deal, journey ticks when you complete a step. This page
              just reads them back as funnel metrics.
            </p>
            <p>
              Nothing here calls a server. Numbers are real-time. Clear your
              browser's site data and they all reset.
            </p>
          </>
        }
      />

      <ProgressDashboard />
    </main>
  );
}
