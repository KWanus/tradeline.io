import Link from "next/link";

import { readInbox } from "@/lib/replies";
import { PageHeader } from "../../_components/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Reply intents that mean a portfolio tape is in motion.
const TAPE_INTENTS = new Set(["has-tape", "tape-detail-request"]);

export default async function TapeInboxPage() {
  let replies: Awaited<ReturnType<typeof readInbox>> = [];
  try {
    replies = await readInbox();
  } catch {}

  const tapeReplies = replies.filter(
    (r) => r.classification && TAPE_INTENTS.has(r.classification)
  );

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageHeader
        icon={<span aria-hidden>✉</span>}
        title="Tape inbox"
        badge={{ label: "Deals", tone: "success" }}
        tagline="When a broker reply signals a portfolio tape is coming, it surfaces here. Open the tape copilot to score the file once it lands."
        meta={
          <Link
            href="/app/tools/tape"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Open tape copilot →
          </Link>
        }
      />

      {tapeReplies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-6 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          No tapes in motion yet. When a broker replies that they have a tape —
          or asks for your details before sending one — it shows up here so it
          doesn&apos;t get lost in the{" "}
          <Link href="/app/inbox/replies" className="text-[color:var(--color-accent)] underline">
            replies inbox
          </Link>
          . You can drop any tape file into the{" "}
          <Link href="/app/tools/tape" className="text-[color:var(--color-accent)] underline">
            tape copilot
          </Link>{" "}
          to score it.
        </div>
      ) : (
        <div className="space-y-3">
          {tapeReplies.map((r) => (
            <div key={r.id} className="card-elevated p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-[15px] font-semibold text-[color:var(--color-fg)]">
                  {r.fromName || r.fromEmail}
                </h4>
                <span className="font-mono text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full border border-[color:var(--color-success-dim)] text-[color:var(--color-success)]">
                  {r.classification === "has-tape" ? "Has a tape" : "Needs deal details"}
                </span>
                {r.bankName && (
                  <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
                    {r.bankName}
                  </span>
                )}
              </div>
              {r.summary && (
                <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {r.summary}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Link href="/app/inbox/replies" className="btn-primary">
                  Reply →
                </Link>
                <Link
                  href="/app/tools/tape"
                  className="px-3 py-2 rounded-full text-[12px] border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                >
                  Score a tape
                </Link>
                {!r.handledAt && (
                  <span className="ml-auto font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-warn)]">
                    Awaiting reply
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
