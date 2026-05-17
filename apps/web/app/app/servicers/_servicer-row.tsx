"use client";

import { useState } from "react";
import { fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";

export type Servicer = {
  name: string;
  shortName: string;
  url: string;
  focus: string[];
  size: string;
  notes: string;
};

export function ServicerRow({ servicer }: { servicer: Servicer }) {
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

  const subject = `Servicer fit · [FIRM] for ${servicer.shortName}`;
  const body = fillTemplate(
    [
      `Hi ${servicer.shortName} team,`,
      ``,
      `Brief intro — [FIRM] is a [STATE]-licensed debt buyer focused on [ASSET_FOCUS]. Building our servicer panel and wanted to start a conversation with you.`,
      ``,
      `What we're looking for in a third-party servicer:`,
      `- Coverage for our buy lane (${servicer.focus.slice(0, 3).join(" / ")} fits us)`,
      `- Monthly remittance with reconciliation`,
      `- Reg F + FDCPA compliance posture you can document`,
      `- Validation notice within 5 days of placement`,
      `- Buyback workflow for BK / deceased / SCRA / disputes`,
      ``,
      `Quick on us:`,
      `- Average ticket: [TICKET]`,
      `- License + bond ready, all collection states`,
      `- Expected near-term volume: 1–3 portfolios per quarter`,
      ``,
      `Could you share your standard fee schedule + a sample monthly remittance template? Happy to put together our buyer profile + first-portfolio specs for a fit conversation.`,
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
          <h2 className="text-xl font-medium text-[color:var(--color-fg)]">{servicer.name}</h2>
          <div className="mt-1 font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
            {servicer.size}
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
          <a
            href={servicer.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Visit ↗
          </a>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {servicer.focus.map((f) => (
          <span
            key={f}
            className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] rounded"
          >
            {f}
          </span>
        ))}
      </div>

      <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {servicer.notes}
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
            Servicer fit intro to {servicer.shortName}
          </div>
          <p className="text-[12px] text-[color:var(--color-fg-dim)] leading-snug mb-3">
            Generic relationship-builder before you have a tape to place.
            Asks for their fee schedule + sample remittance template — both
            things you need before signing an MSA.
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
              placeholder={`${servicer.shortName.toLowerCase()} contact email…`}
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
              ✓ Intro sent to {servicer.shortName}.
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
