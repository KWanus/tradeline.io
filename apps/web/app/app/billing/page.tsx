import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { BillingEditor } from "./_editor";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageHeader
        icon={<span aria-hidden>$</span>}
        title="Billing"
        badge={{ label: "Plan", tone: "primary" }}
        tagline="Stripe products, prices, and your current MRR — five tiers wired up."
        meta={
          <Link
            href="/app/learn#billing"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Pricing strategy →
          </Link>
        }
      />

      <BillingEditor />
    </main>
  );
}
