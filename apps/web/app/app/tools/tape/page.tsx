import { TapeUploader } from "./_uploader";

export const dynamic = "force-dynamic";

export default function TapeCopilotPage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Tape evaluation copilot
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          Drop a tape. Get scored.
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          Drop a CSV from a broker — Tradeline computes the aggregates a buyer
          needs to bid: face value, geographic mix, vintage spread, and a max-bid
          range based on your IRR target. Parsed entirely in your browser.
        </p>
      </header>

      <TapeUploader />

      <section className="mt-12 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Compliance posture
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          The CSV you upload is parsed in your browser via the browser&rsquo;s
          FileReader. Row-level data — names, addresses, phones, SSNs, account
          numbers — never leaves this page. Only the aggregates (face value, state
          counts, vintage years, asset class buckets) appear in the UI, and even
          those aren&rsquo;t persisted unless you choose to save them.
        </p>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          PII column headers (name, address, phone, SSN, DOB, account number) are
          detected and skipped at parse time. The list of redacted columns is shown
          in the warnings so you can verify nothing was processed that shouldn&rsquo;t
          have been.
        </p>
      </section>

      <section className="mt-6 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          Expected CSV format
        </div>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Common broker tape formats are auto-detected. The parser looks for any of:
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
            Vintage:{" "}
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
