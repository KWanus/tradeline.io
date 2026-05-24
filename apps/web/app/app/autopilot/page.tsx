import { PageIntro } from "../_components/page-intro";
import { AutopilotPanel } from "./_panel";

export const dynamic = "force-dynamic";

export default function AutopilotPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageIntro
        eyebrow="Autopilot"
        title={<>Let the system run the daily loop for you.</>}
        lead={
          <>
            Every weekday at 9am EDT, autopilot pulls today&rsquo;s outreach
            queue, finds a contact at each bank, personalizes the draft, and
            ships up to N emails — capped to protect your domain reputation.
            You wake up to a summary email and 20 minutes of replies.
          </>
        }
        doNow="Start in dry-run mode. Watch the daily summaries for 3 days, then flip live."
        howThisWorks={
          <>
            <p>
              You stay in the loop: replies route to your inbox (autopilot
              never auto-responds), and the system pauses itself if you
              haven&rsquo;t opened the workbase in 7 days.
            </p>
            <p>
              All configuration lives in <code>data/autopilot-state.json</code>{" "}
              in your data branch. The wizard updates it via the GitHub API.
              Pause anytime — takes effect on the next cron run.
            </p>
          </>
        }
      />

      <AutopilotPanel />
    </main>
  );
}
