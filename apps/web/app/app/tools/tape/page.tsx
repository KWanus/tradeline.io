import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "../../_components/page-header";
import { RecentDecodes } from "./_recent-decodes";
import { TapeUploader } from "./_uploader";

export const dynamic = "force-dynamic";

export default function TapeCopilotPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>◎</span>}
        title="Tape copilot"
        badge={{ label: "Tool", tone: "primary" }}
        tagline="Drop in a tape CSV. Get a per-borrower risk score and a recommended bid."
        meta={
          <Link
            href="/app/learn#tape"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line)] text-[10px] font-mono tracking-[0.16em] uppercase text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Tape format →
          </Link>
        }
      />

      <RecentDecodes />

      <Suspense
        fallback={
          <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
            Loading tape copilot…
          </div>
        }
      >
        <TapeUploader />
      </Suspense>

      <section className="mt-12 rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-fg-faint)] uppercase">
          Your data never leaves this page
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          The CSV is parsed by your browser. Row-level data — names, addresses,
          phones, SSNs, account numbers — never touches our servers. Only the
          totals appear in the UI, and even those are not saved unless you click
          Save.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Common PII column headers (name, address, phone, SSN, DOB, account
          number) are detected and skipped automatically. Skipped columns appear
          in the warning list so you can verify nothing sensitive was processed.
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-fg-faint)] uppercase">
          What columns the parser recognizes
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          The parser looks for any of these column names (your CSV needs at least
          one balance column):
        </p>
        <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-[color:var(--color-fg-dim)] font-mono">
          <li>
            Balance:{" "}
            <code>
              account_balance · balance · face_value · principal · upb · amount_owed
            </code>
          </li>
          <li>
            State: <code>state · st · billing_state · debtor_state</code>
          </li>
          <li>
            Age:{" "}
            <code>charge_off_date · co_date · vintage · last_payment_date</code>
          </li>
          <li>
            Asset class:{" "}
            <code>asset_type · product · loan_type · debt_type · class</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
