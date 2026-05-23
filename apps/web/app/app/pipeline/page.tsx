import { PageIntro } from "../_components/page-intro";
import { ClosingKit } from "./_closing-kit";
import { PipelineBoard } from "./_pipeline-board";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageIntro
        eyebrow="Workflow"
        title={<>Every deal you&rsquo;re working on, in one place.</>}
        lead={
          <>
            A &ldquo;deal&rdquo; is a chunk of debt a broker is selling. You&rsquo;ll
            usually have 5–15 in motion at once. This page tracks each one from the
            first time you saw it to closing or walking away.
          </>
        }
        doNow="Click + Add deal to log one you just heard about. Move it forward as you learn more."
        howThisWorks={
          <>
            <p>Each deal moves through five stages:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Sourced</strong> — you saw it (broker email, posting, radar
                hit). Almost no info yet.
              </li>
              <li>
                <strong>Reviewing</strong> — you asked the broker for the tape and
                basic details.
              </li>
              <li>
                <strong>Underwriting</strong> — you&rsquo;re running the numbers in
                the bid calculator and tape copilot.
              </li>
              <li>
                <strong>Bidding</strong> — you submitted an offer. Waiting on the
                broker.
              </li>
              <li>
                <strong>Won / Lost / Walked</strong> — final outcome. Won = you
                bought it. Lost = broker took a higher bid. Walked = you backed out.
              </li>
            </ul>
            <p>
              Today this saves to your browser only. Once you have paying customers,
              it moves to a real database so your team can share it.
            </p>
          </>
        }
      />

      <PipelineBoard />
      <ClosingKit />
    </main>
  );
}
