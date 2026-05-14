import { PageIntro } from "../_components/page-intro";
import { BillingEditor } from "./_editor";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageIntro
        eyebrow="Billing setup"
        title={<>Paste your Stripe Payment Links once. Charge customers today.</>}
        lead={
          <>
            Real Stripe Checkout integration (with auth + webhooks) is Phase 2.
            <strong className="text-[color:var(--color-fg)]">
              {" "}
              Stripe Payment Links work today.
            </strong>{" "}
            Create one per tier in your Stripe dashboard, paste the URL here, and the
            workbase will wire them everywhere — pricing tiles on the homepage, &ldquo;Copy
            pay link&rdquo; buttons next to every customer, even email signatures.
          </>
        }
        doNow="Open dashboard.stripe.com → Payment Links → New. Set 5 recurring prices ($99, $499, $1,499, $4,999, $9,999 monthly). Paste the URLs below."
        howThisWorks={
          <>
            <p>
              Payment Links are Stripe&rsquo;s simplest billing primitive. Each one is a
              public URL. The customer clicks it, fills out a card, and Stripe handles
              the recurring billing forever. No code on your side — Stripe emails you
              when payment fails, when subscriptions cancel, when refunds happen.
            </p>
            <p>
              When you have ~10 customers and want native checkout inside Tradeline
              (so they don&rsquo;t leave the site, and so the workbase auto-updates
              MRR), that&rsquo;s the Phase 2 build with Stripe Webhooks + Clerk auth.
              Until then: Payment Links scale fine.
            </p>
          </>
        }
      />

      <BillingEditor />
    </main>
  );
}
