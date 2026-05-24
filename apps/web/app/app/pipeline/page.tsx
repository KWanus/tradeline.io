import Link from "next/link";
import { PageHeader } from "../_components/page-header";
import { ClosingKit } from "./_closing-kit";
import { PipelineBoard } from "./_pipeline-board";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>⟿</span>}
        title="Pipeline"
        badge={{ label: "Live", tone: "success" }}
        tagline="Every deal in motion — sourced through closed. Drag to advance stages."
        meta={
          <Link
            href="/app/learn#pipeline"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            How stages work →
          </Link>
        }
      />

      <PipelineBoard />
      <ClosingKit />
    </main>
  );
}
