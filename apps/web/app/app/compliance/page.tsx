import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { ComplianceBoard } from "./_compliance-board";
import { RuleChangelogPanel } from "./_rule-changelog-panel";

export const dynamic = "force-dynamic";

export default function CompliancePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>§</span>}
        title="Compliance"
        badge={{ label: "Required", tone: "warn" }}
        tagline="License, bond, and state filings. Expirations turn red 30 days out."
        meta={
          <Link
            href="/app/learn#compliance"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Compliance basics →
          </Link>
        }
      />

      <ComplianceBoard />

      <div className="mt-12">
        <RuleChangelogPanel />
      </div>
    </main>
  );
}
