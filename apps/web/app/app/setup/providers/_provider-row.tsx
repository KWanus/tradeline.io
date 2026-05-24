"use client";

import { useState } from "react";
import { fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";
import type { Provider, ProviderCategory } from "@/lib/setup-providers";

const QUOTE_REQUEST: Record<
  ProviderCategory,
  { subject: string; bodyLines: string[] }
> = {
  "ein-formation": {
    subject: "LLC formation + EIN — new entity quote",
    bodyLines: [
      `Hi,`,
      ``,
      `I'm forming a new entity for a [STATE]-based debt-buying business. Need:`,
      ``,
      `- LLC filing in [STATE]`,
      `- Federal EIN`,
      `- Registered agent (year one, can be your in-house option if you offer it)`,
      `- Operating agreement template`,
      ``,
      `What's your turnaround + total all-in cost for the bundle? Any state-fee surprises I should plan for?`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
    ],
  },
  "registered-agent": {
    subject: "Registered agent — quote for [STATE] LLC",
    bodyLines: [
      `Hi,`,
      ``,
      `Need a registered agent for a [STATE] LLC (debt-buying entity). Looking for:`,
      ``,
      `- Year-one + recurring annual rate`,
      `- Same-day mail forwarding`,
      `- Online dashboard for service-of-process notifications`,
      `- Compliance reminders for annual report filings`,
      ``,
      `Could you send the standard agreement + pricing?`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
    ],
  },
  bank: {
    subject: "Business bank account — debt-buyer LLC",
    bodyLines: [
      `Hi,`,
      ``,
      `I'm opening a business checking account for a [STATE]-licensed debt-buying LLC. Account use case is:`,
      ``,
      `- ACH out to brokers (purchase wires, typically $15k–$500k)`,
      `- ACH in from servicer (monthly remittance)`,
      `- Standard ops payments`,
      ``,
      `Want to confirm you'll bank this business type — some banks reject collection-adjacent entities at underwriting. If you do, what's the minimum balance / monthly fee structure and how long is account-opening typically?`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
    ],
  },
  "surety-bond": {
    subject: "Surety bond — [STATE] debt-buyer license",
    bodyLines: [
      `Hi,`,
      ``,
      `Need a surety bond to satisfy [STATE]'s debt-buyer license requirement. Specifics:`,
      ``,
      `- State: [STATE]`,
      `- Bond amount: [BOND_AMOUNT] (or per state requirement — confirm)`,
      `- Entity: new LLC, principal owner [YOUR_NAME]`,
      `- Expected annual NPL volume: ~$1–5M face`,
      ``,
      `Could you send the underwriting application + annual premium estimate? Happy to provide personal financial statements once we engage.`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
    ],
  },
  insurance: {
    subject: "E&O insurance — debt-buying operations",
    bodyLines: [
      `Hi,`,
      ``,
      `Looking for Errors & Omissions coverage for a [STATE]-licensed debt-buying LLC. Coverage criteria most servicers and lenders ask us to carry:`,
      ``,
      `- $1M aggregate / $1M per occurrence to start`,
      `- Operations: portfolio purchase + servicer oversight (no direct consumer contact)`,
      `- Industry: third-party debt buyer (NAICS 522298)`,
      `- Buy-side only; no collection license`,
      ``,
      `What's your premium for this profile + standard exclusions list?`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
    ],
  },
  attorney: {
    subject: "Engagement inquiry — consumer-finance / debt-buyer counsel",
    bodyLines: [
      `Hi,`,
      ``,
      `I'm forming a [STATE]-based debt-buying LLC and looking for retained counsel familiar with FCRA, FDCPA, Reg F, and state-by-state debt-buyer licensing rules. Specific near-term needs:`,
      ``,
      `- Review of standard purchase-and-sale agreement template`,
      `- Servicer MSA review`,
      `- [STATE] license application sanity check`,
      `- On-call advisory on contact-frequency and validation-notice questions`,
      ``,
      `Are you taking new clients in this lane? What's your retainer + hourly?`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
    ],
  },
  cpa: {
    subject: "CPA engagement — receivables / debt-portfolio accounting",
    bodyLines: [
      `Hi,`,
      ``,
      `Forming a [STATE]-based debt-buying LLC and need a CPA who knows receivables-specialty accounting. Specifically:`,
      ``,
      `- Debt-portfolio mark-to-market`,
      `- Recovery-accrual revenue recognition`,
      `- Charge-off vs putback bookkeeping`,
      `- Pass-through tax structure for an early-stage debt-buying LLC`,
      `- Federal + [STATE] returns; quarterly estimates`,
      ``,
      `Are you taking new clients for the upcoming tax year? Standard fee structure?`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
    ],
  },
};

export function ProviderRow({ provider }: { provider: Provider }) {
  const [profile] = useBuyerProfile();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [copied, setCopied] = useState<"email" | null>(null);
  const [sendState, setSendState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "ok"; messageId: string }
    | { kind: "disabled" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const template = QUOTE_REQUEST[provider.category];
  const subject = fillTemplate(template.subject, profile);
  const body = fillTemplate(template.bodyLines.join("\n"), profile);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied("email");
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const submit = async () => {
    if (!recipient.trim()) return;
    setSendState({ kind: "sending" });
    try {
      const r = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient.trim(),
          subject,
          text: body,
          replyTo: profile.email || undefined,
        }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setSendState({ kind: "disabled" });
        return;
      }
      if (!r.ok || data.error) {
        setSendState({ kind: "error", message: data.error || `HTTP ${r.status}` });
        return;
      }
      setSendState({ kind: "ok", messageId: data.providerMessageId || "" });
    } catch (err) {
      setSendState({ kind: "error", message: (err as Error).message });
    }
  };

  const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <article className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 hover:border-[color:var(--color-line-strong)] transition rounded-lg">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-medium text-[color:var(--color-fg)]">
            {provider.beginnerFriendly && (
              <span
                className="text-[color:var(--color-accent)] mr-2"
                title="Beginner-friendly"
              >
                ●
              </span>
            )}
            {provider.name}
          </h3>
          <div className="mt-1 font-mono text-[12px] text-[color:var(--color-fg-dim)] tracking-[0.05em]">
            {provider.costRange}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#0a0c14] hover:opacity-90 transition"
            style={{ background: "var(--gradient-primary)" }}
          >
            {open ? "Hide quote" : "Request quote ⚡"}
          </button>
          {provider.url && (
            <a
              href={provider.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              Visit ↗
            </a>
          )}
        </div>
      </div>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {provider.notes}
      </p>

      {open && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{
            background:
              "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            border: "1.5px solid transparent",
          }}
        >
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)] mb-2">
            Request a quote from {provider.name}
          </div>
          <p className="text-[12px] text-[color:var(--color-fg-dim)] leading-snug mb-3">
            Pre-filled with your state + firm. The asks are calibrated to this
            provider category — they&rsquo;ll know you&rsquo;re not wasting
            their time.
          </p>
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-3 mb-3">
            <div className="font-mono text-[11px] text-[color:var(--color-fg-dim)] mb-2">
              <span className="text-[color:var(--color-fg-faint)]">Subject:</span> {subject}
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-[color:var(--color-fg)] leading-relaxed">
              {body}
            </pre>
          </div>
          <div className="flex items-stretch gap-2 flex-wrap">
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="provider contact email…"
              className="flex-1 min-w-[200px] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded px-3 py-1.5 text-[12px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!recipient.trim() || sendState.kind === "sending"}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#0a0c14] hover:opacity-90 disabled:opacity-40 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              {sendState.kind === "sending" ? "Sending…" : "Request ⚡"}
            </button>
            <a
              href={mailto}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
            >
              Open in mail ↗
            </a>
            <button
              type="button"
              onClick={copy}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              {copied === "email" ? "Copied ✓" : "Copy"}
            </button>
          </div>
          {sendState.kind === "ok" && (
            <div className="mt-2 rounded-lg border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] px-3 py-2 text-[12px] text-[color:var(--color-success)]">
              ✓ Quote request sent.
            </div>
          )}
          {sendState.kind === "disabled" && (
            <div className="mt-2 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-3 py-2 text-[12px] text-[color:var(--color-warn)]">
              Auto-send needs RESEND_API_KEY on the server. Use Copy or Open in mail.
            </div>
          )}
          {sendState.kind === "error" && (
            <div className="mt-2 rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[12px] text-[color:var(--color-danger)]">
              Send failed: {sendState.message}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
