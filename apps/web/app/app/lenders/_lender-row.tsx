"use client";

import { useState } from "react";
import { fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";
import type { Lender } from "@/lib/lenders";
import { LENDER_TYPE_LABEL } from "@/lib/lenders";

export function LenderRow({ lender }: { lender: Lender }) {
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

  const subject = `Hypothecation interest — ${lender.shortName} fit check`;
  const body = fillTemplate(
    [
      `Hi ${lender.shortName} team,`,
      ``,
      `Brief intro — [FIRM] is a [STATE]-licensed debt buyer running through [SERVICER]. We're building a portfolio in [ASSET_FOCUS] paper, current ticket [TICKET].`,
      ``,
      `Reaching out early. We're not seeking a facility today; we want to make sure when we cross your seasoning threshold (${lender.minSeasoningMonths}+ months) we're a fit for your underwriting on ${lender.collateralFocus.slice(0, 3).join(" / ")}.`,
      ``,
      `Quick on us:`,
      `- License + bond ready, all states we collect in`,
      `- Audited monthly servicer remittance reports`,
      `- Buyback workflow (BK / deceased / SCRA / disputes) standard in every purchase contract`,
      `- Plan: stay within your typical ticket range (${lender.ticketRange}) on initial draw, then scale`,
      ``,
      `Could you share the actual underwriting checklist + first-meeting prerequisites? Happy to put our deck and most-recent portfolio audit in the right format.`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
      `[PHONE] · [EMAIL]`,
      `License [LICENSE]`,
    ].join("\n"),
    profile
  );

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
    <article
      className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 hover:border-[color:var(--color-line-strong)] transition rounded-lg"
    >
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-medium text-[color:var(--color-fg)]">{lender.name}</h2>
          <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
            {LENDER_TYPE_LABEL[lender.type]}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#1a0c00] hover:opacity-90 transition"
            style={{ background: "var(--gradient-primary)" }}
          >
            {open ? "Hide intro" : "Send intro ⚡"}
          </button>
          {lender.url && (
            <a
              href={lender.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
            >
              Visit ↗
            </a>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Collateral focus">
          <div className="flex flex-wrap gap-1.5">
            {lender.collateralFocus.map((c) => (
              <span
                key={c}
                className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]"
              >
                {c}
              </span>
            ))}
          </div>
        </Field>
        <Field label="Advance rate">{lender.advanceRateRange}</Field>
        <Field label="Typical ticket">{lender.ticketRange}</Field>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Min seasoning">{lender.minSeasoningMonths} months</Field>
        <Field label="How buyers reach them">{lender.contactPath}</Field>
      </div>

      <div className="mt-5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {lender.notes}
      </div>

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
            Pre-emptive intro to {lender.shortName}
          </div>
          <p className="text-[12px] text-[color:var(--color-fg-dim)] leading-snug mb-3">
            For an actual loan request on a specific seasoned portfolio, use the
            &ldquo;Compose lender pitch ⚡&rdquo; button inside that holding on{" "}
            <a href="/app/portfolio" className="text-[color:var(--color-accent)] hover:underline">/app/portfolio</a>.
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
              placeholder={`${lender.shortName.toLowerCase()} contact email…`}
              className="flex-1 min-w-[200px] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded px-3 py-1.5 text-[12px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!recipient.trim() || sendState.kind === "sending"}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#1a0c00] hover:opacity-90 disabled:opacity-40 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              {sendState.kind === "sending" ? "Sending…" : "Send intro ⚡"}
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
              ✓ Intro sent to {lender.shortName}.
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-1.5 text-[13px] text-[color:var(--color-fg)]">{children}</div>
    </div>
  );
}
