import { PageIntro } from "../_components/page-intro";
import { ComplianceBoard } from "./_compliance-board";

export const dynamic = "force-dynamic";

export default function CompliancePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Workflow"
        title={<>Don&rsquo;t get blindsided by an expiring license.</>}
        lead={
          <>
            Each state where you buy debt needs a license and a bond. They renew
            every 1–2 years. Miss a renewal and you&rsquo;re collecting illegally
            until you reinstate. Add each one here and you&rsquo;ll see a warning 90
            days before it expires.
          </>
        }
        doNow="Click + Add license for every state you operate in. Set expiration dates from your filing paperwork."
        howThisWorks={
          <>
            <p>
              A debt-buyer license costs $1k–$10k to file, plus a surety bond of
              $5k–$50k depending on the state. Both have to be renewed before they
              lapse — usually every 1–2 years.
            </p>
            <p>
              This page tracks each state license you hold: when it expires, who
              issued the bond, the bond amount, and the annual fee. Cards turn
              yellow 90 days before expiration and red at 30 days.
            </p>
            <p>
              It also includes a state-by-state Statute of Limitations chart — how
              many years after default you can legally collect (3 to 10+ years
              depending on state).
            </p>
          </>
        }
      />

      <ComplianceBoard />
    </main>
  );
}
