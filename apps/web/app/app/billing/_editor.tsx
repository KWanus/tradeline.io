"use client";

import Link from "next/link";
import { useState } from "react";
import {
  isValidStripeLink,
  TIER_INFO,
  TIER_ORDER,
  usePaymentLinks,
  type Tier,
} from "@/lib/billing";

function formatUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function BillingEditor() {
  const [links, setLink, remove] = usePaymentLinks();
  const [copied, setCopied] = useState<Tier | null>(null);

  const configuredCount = TIER_ORDER.filter((t) => links[t]).length;

  const copy = async (tier: Tier, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(tier);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div
        className={`rounded-lg border p-4 flex items-center justify-between gap-3 flex-wrap ${
          configuredCount === TIER_ORDER.length
            ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
            : configuredCount > 0
              ? "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
              : "border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              configuredCount === TIER_ORDER.length
                ? "bg-[color:var(--color-success)] glow"
                : configuredCount > 0
                  ? "bg-[color:var(--color-accent)] glow"
                  : "bg-[color:var(--color-warn)]"
            }`}
          />
          <span className="text-[14px] text-[color:var(--color-fg)]">
            {configuredCount === TIER_ORDER.length ? (
              <>All tiers wired · ready to charge</>
            ) : configuredCount > 0 ? (
              <>
                {configuredCount} / {TIER_ORDER.length} tiers wired
              </>
            ) : (
              <>No tiers wired yet — pricing tiles use mailto for now</>
            )}
          </span>
        </div>
        <a
          href="https://dashboard.stripe.com/payment-links/create"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          Stripe Dashboard ↗
        </a>
      </div>

      {/* Tier rows */}
      <div className="space-y-3">
        {TIER_ORDER.map((tier) => {
          const info = TIER_INFO[tier];
          const link = links[tier] || "";
          const valid = isValidStripeLink(link);
          const empty = !link;
          return (
            <div
              key={tier}
              className={`rounded-xl border p-4 md:p-5 ${
                valid
                  ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
                  : empty
                    ? "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
                    : "border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
                      {info.label}
                    </span>
                    <span className="font-serif text-2xl text-[color:var(--color-fg)]">
                      {formatUSD(info.price)}
                    </span>
                    <span className="text-[12px] text-[color:var(--color-fg-faint)]">/mo</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
                    {info.audience}
                  </p>
                </div>
                {valid && (
                  <button
                    type="button"
                    onClick={() => copy(tier, link)}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                  >
                    {copied === tier ? "Copied ✓" : "Copy link"}
                  </button>
                )}
              </div>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(tier, e.target.value)}
                  placeholder="https://buy.stripe.com/..."
                  className="flex-1 bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[13px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
                />
                {link && (
                  <button
                    type="button"
                    onClick={() => remove(tier)}
                    title="Clear this link"
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
                  >
                    Clear
                  </button>
                )}
              </div>
              {link && !valid && (
                <p className="mt-2 text-[11px] text-[color:var(--color-warn)]">
                  Doesn&rsquo;t look like a Stripe Payment Link. Expected:{" "}
                  <code className="font-mono">https://buy.stripe.com/...</code>
                </p>
              )}
              {valid && (
                <div className="mt-3 text-[11px] text-[color:var(--color-fg-faint)] flex items-center gap-2 flex-wrap">
                  <span>✓ Live · used by:</span>
                  <Link
                    href="/#pricing"
                    className="hover:text-[color:var(--color-accent)] transition"
                  >
                    homepage pricing card
                  </Link>
                  <span>·</span>
                  <Link
                    href="/app/customers"
                    className="hover:text-[color:var(--color-accent)] transition"
                  >
                    customer cards
                  </Link>
                  <span>·</span>
                  <Link
                    href="/app/subscribers"
                    className="hover:text-[color:var(--color-accent)] transition"
                  >
                    subscriber cards
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help footer */}
      <section className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 text-[13px] text-[color:var(--color-fg-dim)]">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          How to create a Payment Link in Stripe
        </div>
        <ol className="space-y-1.5 list-decimal pl-5 leading-relaxed">
          <li>
            Open{" "}
            <a
              href="https://dashboard.stripe.com/payment-links/create"
              target="_blank"
              rel="noreferrer"
              className="text-[color:var(--color-accent)] hover:underline"
            >
              dashboard.stripe.com/payment-links/create
            </a>
          </li>
          <li>Product = &ldquo;Tradeline {"{tier}"} Plan&rdquo; (e.g. &ldquo;Tradeline Pro Plan&rdquo;)</li>
          <li>Price = recurring monthly · USD · amount per the tier</li>
          <li>Optional: enable 14-day trial under &ldquo;Subscription settings&rdquo;</li>
          <li>Copy the URL (looks like <code className="font-mono">https://buy.stripe.com/...</code>)</li>
          <li>Paste it into the matching tier above. Saves instantly.</li>
        </ol>
        <p className="mt-3 text-[12px] text-[color:var(--color-fg-faint)]">
          Stripe handles dunning, failed payment retries, and cancellations automatically.
          When you&rsquo;re ready for native checkout (so customers stay on Tradeline), the
          Phase 2 wire-up uses these same products + Stripe Webhooks.
        </p>
      </section>
    </div>
  );
}
