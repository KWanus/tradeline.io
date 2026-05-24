import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { BROKERS } from "@/lib/brokers";
import { BrokerRow } from "./_broker-row";

export const dynamic = "force-dynamic";

export default function BrokersPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>⇆</span>}
        title="Brokers"
        badge={{ label: "Live", tone: "success" }}
        tagline="Where deals actually come from. Track who's posting what."
        meta={
          <Link
            href="/app/learn#brokers"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            How brokers work →
          </Link>
        }
      />

      <section className="space-y-3">
        {BROKERS.map((b) => (
          <BrokerRow key={b.shortName} broker={b} />
        ))}
      </section>

      <section className="mt-12 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What this becomes in Phase 2
        </div>
        <ul className="mt-3 space-y-2 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>Live posting feed per broker — Tradeline ingests their listing pages and pings you when matching paper appears</li>
          <li>Your bid history per broker — close rate, average days to close, post-close behavior</li>
          <li>Broker reputation scoring (tape accuracy, post-close cooperation) once enough customers contribute data</li>
          <li>Tradeline-mediated bid platform (Phase 3) — submit bids without leaving the workbase</li>
        </ul>
      </section>

      <p className="mt-10 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Curated as of 2026-05-06. Names + URLs are public; cadence and notes are starting
        approximations and will drift. Verify before approaching.
      </p>
    </main>
  );
}

