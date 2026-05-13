import { PageIntro } from "../_components/page-intro";
import { DeployTracker } from "./_tracker";

export const dynamic = "force-dynamic";

export default function DeployPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <PageIntro
        eyebrow="Deploy progress"
        title={<>Get Tradeline live on the internet.</>}
        lead={
          <>
            Six steps from &ldquo;repo on GitHub&rdquo; to &ldquo;site taking customers.&rdquo;
            Each step has a checkbox (saves on this device), the exact link to where you do it,
            and a sanity check so you know it worked. ~30 minutes, ~$18/year out of pocket.
          </>
        }
        doNow="Work top-to-bottom. Tick each box as you finish — the progress bar updates and the next-up step glows."
        howThisWorks={
          <>
            <p>
              This is the same checklist as <code className="font-mono text-[12px] text-[color:var(--color-fg)]">DEPLOY.md</code> in the repo,
              just with state tracking. Your progress saves to this browser only.
            </p>
            <p>
              If you get stuck, open <strong>Tradeline AI</strong> from the bottom-right —
              it knows every step and can troubleshoot from the build logs.
            </p>
          </>
        }
      />

      <DeployTracker />
    </main>
  );
}
