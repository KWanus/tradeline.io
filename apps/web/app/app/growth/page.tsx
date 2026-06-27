import Link from "next/link";

import { PageHeader } from "../_components/page-header";
import { GrowthDesk } from "./_desk";

export const dynamic = "force-dynamic";

export default function GrowthPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageHeader
        icon={<span aria-hidden>✺</span>}
        title="Growth engine"
        badge={{ label: "Sales", tone: "primary" }}
        tagline="Finds businesses that would pay for Tradeline, drafts each email with a link to the visual tour, and queues them. You just tap Approve."
        meta={
          <Link
            href="/tour"
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Preview the tour →
          </Link>
        }
      />

      <GrowthDesk />
    </main>
  );
}
