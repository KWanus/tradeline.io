import Link from "next/link";
import {
  PLAN_DETAILS,
  PLANS_ORDERED,
  SUBSCRIBER_TYPE_BUYS,
  SUBSCRIBER_TYPE_LABEL,
  type SubscriberType,
} from "@/lib/subscribers";

export const dynamic = "force-dynamic";

const CUSTOMER_ORDER: SubscriberType[] = [
  "broker",
  "lender",
  "attorney",
  "cpa",
  "fund-of-funds",
  "specialty-finance",
];

export default function MarketplacePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-12 max-w-5xl">
      <header className="mb-16">
        <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Tradeline marketplace
        </div>
        <h1 className="mt-4 font-serif text-5xl md:text-7xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
          Sell to the{" "}
          <span className="italic text-[color:var(--color-accent)]">supply side</span>{" "}
          too.
        </h1>
        <p className="mt-6 text-[color:var(--color-fg-dim)] text-lg md:text-xl leading-relaxed max-w-3xl">
          The radar finds banks heading toward divestiture. Licensed buyers
          subscribe to act on those signals. But the same data has real value
          for the rest of the ecosystem — the brokers running the auctions, the
          lenders financing the buyers, the attorneys defending them, the CPAs
          serving them. This is the page where they sign up.
        </p>
      </header>

      {/* CUSTOMER TYPES */}
      <section className="mb-16">
        <SectionHeader tag="01" title="Who pays for deal-flow intelligence" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {CUSTOMER_ORDER.map((t) => (
            <article
              key={t}
              className="card p-6"
            >
              <h3 className="font-serif italic text-[22px] text-[color:var(--color-fg)] tracking-tight">
                {SUBSCRIBER_TYPE_LABEL[t]}
              </h3>
              <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
                {SUBSCRIBER_TYPE_BUYS[t]}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mb-16">
        <SectionHeader tag="02" title="Pricing tiers" />
        <p className="mt-3 mb-6 text-[15px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Subscribers pay monthly. Pricing scales with originators tracked,
          users, and delivery options. Most brokers and lenders land on Pro;
          single-attorney firms start with Starter; institutional buyers and
          fund-of-funds run Enterprise.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS_ORDERED.map((p) => {
            const info = PLAN_DETAILS[p];
            const isFeatured = p === "pro";
            return (
              <article
                key={p}
                className={`p-6 ${
                  isFeatured
                    ? "card-elevated border-[color:var(--color-accent-dim)]"
                    : "card"
                }`}
              >
                <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  {isFeatured ? (
                    <span className="text-[color:var(--color-accent)]">
                      Recommended
                    </span>
                  ) : (
                    info.label
                  )}
                </div>
                <h3 className="mt-3 font-serif text-[28px] text-[color:var(--color-fg)] tracking-tight">
                  {info.label}
                </h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  {info.mrrUsd === 0 ? (
                    <span className="font-mono text-3xl text-[color:var(--color-fg)] tick">
                      $0
                    </span>
                  ) : (
                    <>
                      <span className="font-mono text-3xl text-[color:var(--color-fg)] tick">
                        ${info.mrrUsd.toLocaleString()}
                      </span>
                      <span className="text-[color:var(--color-fg-faint)] text-[13px]">
                        /mo
                      </span>
                    </>
                  )}
                  {p === "enterprise" && (
                    <span className="text-[color:var(--color-fg-faint)] text-[13px]">
                      +
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {info.description}
                </p>
                <ul className="mt-5 space-y-2 text-[13px] text-[color:var(--color-fg)] leading-snug">
                  {info.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className={`mt-1 inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                          isFeatured
                            ? "bg-[color:var(--color-accent)]"
                            : "bg-[color:var(--color-fg-faint)]"
                        }`}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mb-16">
        <SectionHeader tag="03" title="How alerts work" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Step
            n="1"
            title="Subscriber configures preferences"
            body="Pick which originators (or all), which signal types, which asset classes, what minimum confidence threshold. Choose email, Slack, or webhook delivery."
          />
          <Step
            n="2"
            title="Radar runs every 6 hours"
            body="The same workers that power /app/today scan SEC EDGAR, XBRL, news, and court records. Signals score; matches against subscriber preferences happen automatically."
          />
          <Step
            n="3"
            title="Alert delivered"
            body="A clean, actionable email/message lands in their inbox or workflow. Subscriber acts on it. Tradeline charges monthly."
          />
        </div>

        {/* ALERT PREVIEW */}
        <div className="mt-8 card-elevated p-6 md:p-8">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            What an alert looks like
          </div>
          <div className="mt-4 font-mono text-[12px] bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded p-5 leading-relaxed text-[color:var(--color-fg-dim)]">
            <div>
              <span className="text-[color:var(--color-fg-faint)]">FROM:</span>{" "}
              alerts@tradeline.io
            </div>
            <div>
              <span className="text-[color:var(--color-fg-faint)]">SUBJECT:</span>{" "}
              <span className="text-[color:var(--color-fg)]">
                FITB · Charge-offs accelerating · 0.95 confidence
              </span>
            </div>
            <div className="mt-4 text-[color:var(--color-fg)]">
              Fifth Third Bancorp&rsquo;s 2025 FY 10-K shows a{" "}
              <span className="text-[color:var(--color-warn)]">+115% YoY</span>{" "}
              acceleration in charge-offs against the same period last year.
              Banks at this rate typically evaluate divestiture within 1–2 quarters.
            </div>
            <div className="mt-3 text-[color:var(--color-fg-dim)]">
              ▸ Asset class: credit card<br />
              ▸ Form: 10-K, filed 2026-04-15<br />
              ▸ XBRL signal type: charge_off_increase<br />
              ▸ Period: 2025 FY · YoY +115.3%<br />
              ▸ Source: <span className="text-[color:var(--color-accent)]">data.sec.gov/...</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[color:var(--color-line)] text-[color:var(--color-fg-faint)]">
              You&rsquo;re receiving this because you subscribed to charge-off
              and divestiture signals on FITB at confidence ≥ 0.6.
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mb-12 card-elevated p-8 md:p-12">
        <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-[color:var(--color-fg)]">
          Become a beta partner.
        </h2>
        <p className="mt-3 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          Five supply-side seats, half-price for life, in exchange for
          feedback on alert quality and product direction. Fits brokers,
          mid-tier lenders, specialty CPAs, and consumer-finance attorneys.
        </p>
        <div className="mt-7 flex items-center gap-3 flex-wrap">
          <a
            href="mailto:kwanusmrket@gmail.com?subject=Tradeline%20marketplace%20%E2%80%94%20beta%20partner"
            className="btn-primary"
          >
            Apply &rarr;
          </a>
          <Link
            href="/app/subscribers"
            className="btn-secondary"
          >
            See subscriber dashboard
          </Link>
        </div>
      </section>

      <p className="text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed max-w-2xl">
        Public-source data only. No consumer data. The marketplace product is
        institutional B2B intelligence — same compliance posture as the rest
        of Tradeline. See <Link href="/app/learn" className="text-[color:var(--color-accent)] hover:underline">/app/learn</Link>{" "}
        for the full architecture.
      </p>
    </main>
  );
}

function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-mono text-[12px] text-[color:var(--color-accent)] tracking-wider">
        {tag}
      </span>
      <span className="font-serif italic text-[26px] md:text-[30px] tracking-tight text-[color:var(--color-fg)]">
        {title}
      </span>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="font-mono text-[28px] text-[color:var(--color-accent)] tick">
        {n}
      </div>
      <h3 className="mt-2 font-serif italic text-[18px] text-[color:var(--color-fg)] tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}
