import { PageIntro } from "../_components/page-intro";
import { ProfileEditor } from "./_editor";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageIntro
        eyebrow="Your firm"
        title={<>Fill this in once. Auto-fills every email and template.</>}
        lead={
          <>
            Your firm name, license, bond, servicer, and contact info live here.
            Every broker email, response template, buyer-profile sheet, and AI
            tutor conversation pulls from these fields. Saved locally in your
            browser — never sent anywhere.
          </>
        }
        doNow="Type into the fields below. Saves as you type. You only do this once."
        howThisWorks={
          <>
            <p>The same info is used in:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The outreach email on every bank detail page</li>
              <li>The 7 reply templates for what brokers say back</li>
              <li>The closing playbook scripts on /app/playbook</li>
              <li>The buyer-profile sheet you send brokers on request</li>
              <li>The AI tutor — so it answers using your actual situation</li>
            </ul>
            <p>
              Change anything here and it updates everywhere instantly. No
              save button needed.
            </p>
          </>
        }
      />

      <ProfileEditor />
    </main>
  );
}
