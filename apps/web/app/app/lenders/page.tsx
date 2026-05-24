import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { LENDERS } from "@/lib/lenders";
import { LenderRow } from "./_lender-row";

export const dynamic = "force-dynamic";

export default function LendersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>≣</span>}
        title="Lenders"
        badge={{ label: "Live", tone: "success" }}
        tagline="Operating-line lenders for the next portfolio. Track rates and terms."
        meta={
          <Link
            href="/app/learn#lenders"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            How lending fits →
          </Link>
        }
      />

      <section className="space-y-3">
        {LENDERS.map((l) => (
          <LenderRow key={l.shortName} lender={l} />
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            What lenders actually evaluate
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>12+ months of clean payment history on the collateral pool</li>
            <li>Servicer audit trail (monthly remittance reports, reconciled)</li>
            <li>Asset class quality (secured beats unsecured)</li>
            <li>Geographic and originator diversification</li>
            <li>Your operating history (3+ closed deals as a baseline)</li>
            <li>Bond + license footprint matching collection states</li>
          </ul>
        </div>
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            What kills a hypothecation conversation
          </div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
            <li>Tape under 6 months seasoned</li>
            <li>Single-state or single-originator concentration</li>
            <li>Servicer with a regulatory consent decree</li>
            <li>Asset class outside the lender&rsquo;s collateral focus</li>
            <li>Audited collection history that doesn&rsquo;t match unaudited claims</li>
            <li>Open CFPB / state AG investigation against you</li>
          </ul>
        </div>
      </section>

      <div className="mt-10 flex items-center gap-3 flex-wrap">
        <Link
          href="/app/portfolio"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Check your portfolio&rsquo;s hypothecation eligibility &rarr;
        </Link>
        <Link
          href="/app/capital"
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Capital allocation playbook &rarr;
        </Link>
      </div>

      <p className="mt-8 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Curated as of 2026-05-06. Names + URLs are public; advance rates and
        ticket sizes are approximations and will drift with market conditions.
        Verify before approaching.
      </p>
    </main>
  );
}

