import Link from "next/link";
import { PublicFooter } from "@/app/_components/public-footer";
import { ApplyForm } from "./_form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Apply for design partner · Tradeline",
  description:
    "Half off forever, weekly office hours, your inbound criteria shape the v1 radar. Licensed debt buyers, brokers, hypothecation lenders, and consumer-finance attorneys. Five seats this quarter.",
};

export default function ApplyPage() {
  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#1a0c00] font-serif italic text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-serif italic text-[18px]">Tradeline</span>
        </Link>
        <Link
          href="/report"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Subscribe &rarr;
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
          Founder pricing · five seats
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          Apply for{" "}
          <span className="italic text-gradient-accent">design partner.</span>
        </h1>
        <p className="mt-5 text-[17px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          Half off forever. Weekly office hours with the founder. Your inbound
          criteria shape the v1 radar. We&rsquo;re taking{" "}
          <strong className="text-[color:var(--color-fg)]">five</strong>{" "}
          operators this quarter — licensed debt buyers, brokers, hypothecation
          lenders, or consumer-finance attorneys who actually source deals.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
          <ValueCard
            label="Half off forever"
            body="Locked-in 50% discount on whichever paid tier you settle on, for the life of the account."
          />
          <ValueCard
            label="Office hours"
            body="60 minutes weekly with the founder. We screen-share through your actual deal flow."
          />
          <ValueCard
            label="Roadmap input"
            body="Features you describe land in v1. New radar inputs you need are weighted into the score."
          />
        </div>

        <div className="mt-10">
          <ApplyForm />
        </div>

        <section className="mt-12 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            What happens next
          </div>
          <ol className="mt-3 space-y-2 list-decimal pl-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            <li>
              You submit the form. The founder gets an email within seconds.
            </li>
            <li>
              If it&rsquo;s a fit, you&rsquo;ll hear back within 2-3 business
              days with a 20-minute intro call link.
            </li>
            <li>
              On the call: walk us through the kinds of deals you see. Ten
              minutes max on Tradeline; we want to understand{" "}
              <em>your</em> workflow.
            </li>
            <li>
              If we agree, we onboard you to the workbase at the discounted
              tier and book the weekly office hour.
            </li>
          </ol>
          <p className="mt-4 text-[13px] text-[color:var(--color-fg-faint)]">
            Not ready for the workbase? Subscribe to the{" "}
            <Link
              href="/report"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              free weekly Charge-Off Report
            </Link>{" "}
            and stay close. No commitment.
          </p>
        </section>
      </section>

      <PublicFooter />
    </main>
  );
}

function ValueCard({ label, body }: { label: string; body: string }) {
  return (
    <article className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        {label}
      </div>
      <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {body}
      </p>
    </article>
  );
}
