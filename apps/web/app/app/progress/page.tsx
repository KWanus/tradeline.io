import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { ProgressDashboard } from "./_dashboard";

export const dynamic = "force-dynamic";

export default function ProgressPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>▲</span>}
        title="Progress"
        badge={{ label: "Live", tone: "success" }}
        tagline="Where the work is. Phases done, phases ahead."
        meta={
          <Link
            href="/app/learn#progress"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Roadmap context →
          </Link>
        }
      />

      <ProgressDashboard />
    </main>
  );
}
