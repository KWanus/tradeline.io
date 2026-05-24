import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { DeployTracker } from "./_tracker";

export const dynamic = "force-dynamic";

export default function DeployPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-4xl">
      <PageHeader
        icon={<span aria-hidden>↗</span>}
        title="Deploy"
        badge={{ label: "Setup", tone: "warn" }}
        tagline="Get this thing live — domain, DNS, Stripe, mailer, all in one checklist."
        meta={
          <Link
            href="/app/learn#deploy"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Deploy guide →
          </Link>
        }
      />

      <DeployTracker />
    </main>
  );
}
