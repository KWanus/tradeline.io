import Link from "next/link";
import { PublicFooter } from "@/app/_components/public-footer";

export const dynamic = "force-dynamic";

const LAST_UPDATED = "2026-05-17";

export const metadata = {
  title: "Privacy · Tradeline",
  description:
    "What data Tradeline collects, how we use it, and how to delete it. Plain English.",
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-90 transition"
        >
          <span
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#0a0c14] font-semibold text-[16px]"
            style={{ background: "var(--gradient-primary)" }}
          >
            T
          </span>
          <span className="font-semibold text-[18px]">Tradeline</span>
        </Link>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Privacy
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl tracking-tight leading-[1.05]">
          What we collect. What we don&rsquo;t.
        </h1>
        <p className="mt-3 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)]">
          Last updated {LAST_UPDATED}.
        </p>

        <Section title="The short version">
          <p>
            Tradeline is built so the operator (you) can do their job without
            handling consumer data. The radar uses{" "}
            <strong>public-source filings only</strong> — SEC EDGAR, court
            dockets, public news. The tape copilot runs in your browser; row-
            level files never leave your device. Your own profile and pipeline
            data lives in localStorage on your computer.
          </p>
          <p>
            The one place we collect personal data is the{" "}
            <Link
              href="/report"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              /report
            </Link>{" "}
            subscribe form — and only what you type in.
          </p>
        </Section>

        <Section title="Data Tradeline collects">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Email address.</strong> Required when you subscribe to the
              weekly Charge-Off Report. Used to send the digest and to verify
              one-click unsubscribe links.
            </li>
            <li>
              <strong>Name (optional).</strong> Used in the welcome email
              greeting if you provide it.
            </li>
            <li>
              <strong>Reader type (optional).</strong> Buyer / broker / lender /
              attorney / CPA / other — the dropdown on the subscribe form. Used
              for internal analytics on who the report reaches; never displayed
              publicly.
            </li>
            <li>
              <strong>Server logs.</strong> Standard Vercel access logs (IP,
              user-agent, timestamp) retained for ~30 days for abuse detection
              and uptime debugging. We do not combine these with subscribe-form
              data.
            </li>
          </ul>
        </Section>

        <Section title="Data Tradeline does NOT collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Consumer or debtor data.</strong> The tape copilot parses
              CSVs in your browser. We never see, transmit, or store row-level
              data (names, addresses, phones, SSNs, account numbers). PII column
              headers are auto-detected and skipped during parsing.
            </li>
            <li>
              <strong>Your pipeline, outreach log, or notes.</strong> All
              workbase state is persisted to your browser&rsquo;s localStorage.
              Clearing your browser data clears it everywhere. We don&rsquo;t
              sync, back up, or have access to any of it.
            </li>
            <li>
              <strong>Third-party tracking cookies.</strong> No Google Analytics,
              no Meta pixel, no advertising trackers.
            </li>
            <li>
              <strong>Credit reports or FCRA-regulated data.</strong> Tradeline
              is architected to stay outside FCRA scope. We don&rsquo;t buy,
              sell, ingest, or score consumer credit data.
            </li>
          </ul>
        </Section>

        <Section title="How we use what we collect">
          <p>Your subscribe-form email is used only to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Send the welcome email immediately after signup</li>
            <li>Send the weekly Charge-Off Report (Mondays)</li>
            <li>Verify one-click unsubscribe links (HMAC over your email)</li>
          </ul>
          <p>
            We do not sell, rent, or share your email with third parties. We do
            not send marketing emails for anything other than the weekly report.
          </p>
        </Section>

        <Section title="How to delete your data">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Stop the weekly report.</strong> Click the{" "}
              &ldquo;Unsubscribe&rdquo; link in any weekly email, or visit{" "}
              <Link
                href="/unsubscribe"
                className="text-[color:var(--color-accent)] hover:underline"
              >
                /unsubscribe
              </Link>{" "}
              and use the link from your most recent issue. Your email is added
              to an unsubscribed list and skipped on all future sends.
            </li>
            <li>
              <strong>Full deletion request.</strong> Email{" "}
              <a
                className="text-[color:var(--color-accent)] hover:underline"
                href="mailto:hello@tradeline.io"
              >
                hello@tradeline.io
              </a>{" "}
              with subject &ldquo;delete my data&rdquo; from the address you
              subscribed with. We&rsquo;ll remove your record from the
              subscriber list within 7 business days.
            </li>
            <li>
              <strong>Clear your workbase state.</strong> All localStorage data
              is gone the moment you clear it in your browser settings. There&rsquo;s
              nothing on our side to also clear.
            </li>
          </ul>
        </Section>

        <Section title="Email delivery">
          <p>
            We use{" "}
            <a
              href="https://resend.com"
              target="_blank"
              rel="noreferrer"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              Resend
            </a>{" "}
            for transactional + weekly digest delivery. Resend sees the
            recipient email and the message body when delivering — they have
            their own privacy practices at{" "}
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              resend.com/legal
            </a>
            .
          </p>
        </Section>

        <Section title="Children">
          <p>
            Tradeline is a B2B operator workbase. It is not directed at anyone
            under 18 and we do not knowingly collect data from anyone under 18.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change anything material, we update the last-updated date at
            the top of this page and email active weekly-report subscribers with
            a summary in the next Monday issue. No silent changes.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Email{" "}
            <a
              className="text-[color:var(--color-accent)] hover:underline"
              href="mailto:hello@tradeline.io"
            >
              hello@tradeline.io
            </a>
            . We answer within ~3 business days.
          </p>
        </Section>
      </article>

      <PublicFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-semibold text-2xl tracking-tight text-[color:var(--color-fg)] mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}
