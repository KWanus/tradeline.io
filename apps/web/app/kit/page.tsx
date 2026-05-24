import Link from "next/link";
import { EMPTY_SNAPSHOT, type RadarSnapshot, readSnapshot } from "@/lib/snapshot";
import { PublicFooter } from "@/app/_components/public-footer";
import { KitItem } from "./_kit-item";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata = {
  title: "Kit · share Tradeline · Tradeline",
  description:
    "Pre-written copy and assets for sharing Tradeline. Tweet, LinkedIn post, email template, and the weekly-report social card. One-click copy.",
};

export default async function KitPage() {
  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const banks = snap.originators.length || 57;

  const tweet = `If you buy non-performing loans, Tradeline scans ${banks} US banks every 6 hours for charge-off signals — straight from SEC filings. Free weekly Charge-Off Report. No paywall, no consumer data.

https://tradeline.io/report`;

  const linkedin = `Most debt-buying signals are public, but nobody packages them — until now.

Tradeline scans ${banks} US banks, fintechs, and specialty lenders every 6 hours. SEC 10-K/Q footnotes, XBRL charge-off concepts, 8-K dispositions, matched news. Each bank gets a 0-1 score every Monday.

The weekly Charge-Off Report is free. The workbase is free for design partners this quarter.

If you're a licensed buyer, broker, hypothecation lender, or consumer-finance attorney — this might be useful.

→ https://tradeline.io/report
→ https://tradeline.io/about (how the radar works + what data we touch)`;

  const email = `Subject: Tradeline · weekly charge-off radar for ${banks} US banks

Hey,

Sharing in case it's relevant to your work. Tradeline scans ${banks} US banks every 6 hours for non-performing-loan signals — pulled from public SEC filings, XBRL charge-off concepts, and matched news. Each bank gets scored every Monday in a free weekly report.

Free, no paywall, no consumer data. Subscribe at https://tradeline.io/report — first issue ships within seconds.

Built for licensed debt buyers, brokers, hypothecation lenders, and consumer-finance attorneys. If you fit, the workbase at https://tradeline.io/app is free for design partners this quarter.

—`;

  const conferenceBlurb = `Tradeline · weekly Charge-Off Report
${banks} US banks scored every 6 hours from public SEC filings.
Free. tradeline.io/report`;

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
        <Link
          href="/report"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Subscribe &rarr;
        </Link>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Share kit
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[1.0]">
          Tell people about{" "}
          <span className="italic text-gradient-accent">Tradeline.</span>
        </h1>
        <p className="mt-5 text-[16px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          Pre-written copy you can paste into a tweet, a LinkedIn post, or an
          email to a colleague. Edit freely — the goal is people who buy
          non-performing loans hear about a tool that helps them. Word of
          mouth is how solo founders build.
        </p>

        <section className="mt-10 space-y-6">
          <KitItem
            label="Tweet (≤ 280 chars)"
            description={`${tweet.length} chars — fits one tweet. Edit before posting if you want to add your own voice.`}
            content={tweet}
          />

          <KitItem
            label="LinkedIn post"
            description="3-paragraph format. The first line is the hook; the last line is the CTA."
            content={linkedin}
          />

          <KitItem
            label="Forward-to-a-colleague email"
            description="Subject line included. Plain-text — no formatting. Works fine pasted into Gmail."
            content={email}
            isEmail
          />

          <KitItem
            label="Conference / signature blurb"
            description="3-line micro-pitch. Fits in a conference badge bio, an email signature, or a Slack profile."
            content={conferenceBlurb}
          />
        </section>

        <section className="mt-12 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            Image assets
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            The weekly Charge-Off Report renders a 1200×630 PNG with this
            week&rsquo;s strong / watching counts baked in. Right-click → Save
            as, or share the URL — LinkedIn and Twitter render it automatically
            from the OG card.
          </p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <a
              href="/report/opengraph-image"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              /report card &nearr;
            </a>
            <a
              href="/coverage/opengraph-image"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              /coverage card &nearr;
            </a>
            <a
              href="/about/opengraph-image"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              /about card &nearr;
            </a>
            <a
              href="/apply/opengraph-image"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              /apply card &nearr;
            </a>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            Direct links to share
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <ShareLink label="Subscribe to the weekly" href="/report" />
            <ShareLink label="How the radar works" href="/about" />
            <ShareLink label="Every bank we track" href="/coverage" />
            <ShareLink label="Apply for design partner" href="/apply" />
            <ShareLink label="Try the tape copilot (demo)" href="/app/tools/tape?demo=card-fresh" />
            <ShareLink label="What we ship · changelog" href="/changelog" />
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-accent)]">
            For design partners
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
            Refer a fellow operator who fits (licensed buyer, broker, lender,
            or consumer-finance attorney) and we&rsquo;ll credit you an extra
            3 months of free workbase + name you in the referrer thank-you
            section of the next weekly issue. Just CC{" "}
            <a
              href="mailto:kwanusmrket@gmail.com?subject=Tradeline%20referral"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              kwanusmrket@gmail.com
            </a>{" "}
            on your intro email.
          </p>
        </section>

        <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
          Copy generated for {banks} tracked banks · regenerate by reloading
          this page after the radar refreshes.
        </p>
      </article>

      <PublicFooter />
    </main>
  );
}

function ShareLink({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-4 py-3 hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-bg-2)] transition"
    >
      <div className="text-[14px] text-[color:var(--color-fg)]">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] text-[color:var(--color-fg-faint)]">
        tradeline.io{href}
      </div>
    </Link>
  );
}
