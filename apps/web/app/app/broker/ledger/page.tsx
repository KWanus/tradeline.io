import Link from "next/link";
import { PageHeader } from "../../_components/page-header";
import { Ledger } from "./_ledger";

export const dynamic = "force-dynamic";

export default function LedgerPage() {
  return (
    <main className="relative px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>$</span>}
        title="Ledger"
        badge={{ label: "Revenue", tone: "success" }}
        tagline="Every closed deal, your spread, your monthly run-rate. Export anytime — your P&L lives here."
        meta={
          <Link
            href={"/app/broker" as never}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            ← Workbench
          </Link>
        }
      />
      <Ledger />
    </main>
  );
}
