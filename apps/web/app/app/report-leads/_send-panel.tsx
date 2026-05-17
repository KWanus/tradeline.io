"use client";

import { useState } from "react";
import { useBuyerProfile } from "@/lib/buyer-profile";
import type { ReportLead } from "@/lib/report-leads";

type SendState =
  | { kind: "idle" }
  | { kind: "sending"; mode: "test" | "all" }
  | { kind: "disabled" }
  | { kind: "ok"; sent: number; failed: number; subject: string; mode: "test" | "all" }
  | { kind: "error"; message: string };

export function SendWeeklyPanel({
  leads,
  subject,
  html,
  preheader,
}: {
  leads: ReportLead[];
  subject: string;
  html: string;
  preheader: string;
}) {
  const [profile] = useBuyerProfile();
  const [testEmail, setTestEmail] = useState(profile.email || "");
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const [showPreview, setShowPreview] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const send = async (
    mode: "test" | "all",
    payload: { testEmail?: string; recipients?: string[] }
  ) => {
    setState({ kind: "sending", mode });
    try {
      const r = await fetch("/api/report/send-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await r.json()) as {
        ok?: boolean;
        enabled?: boolean;
        error?: string;
        sent?: number;
        failed?: number;
        subject?: string;
      };
      if (data.enabled === false) {
        setState({ kind: "disabled" });
        return;
      }
      if (!r.ok || !data.ok) {
        setState({
          kind: "error",
          message: data.error || `HTTP ${r.status}`,
        });
        return;
      }
      setState({
        kind: "ok",
        sent: data.sent || 0,
        failed: data.failed || 0,
        subject: data.subject || subject,
        mode,
      });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  const sendTest = () => {
    const e = testEmail.trim();
    if (!e) return;
    send("test", { testEmail: e });
  };

  const sendAll = () => {
    if (!confirmAll) {
      setConfirmAll(true);
      return;
    }
    const emails = leads.map((l) => l.email);
    send("all", { recipients: emails });
    setConfirmAll(false);
  };

  return (
    <section
      className="rounded-xl p-6"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        This week&rsquo;s digest
      </div>
      <h2 className="mt-2 text-xl font-medium tracking-tight text-[color:var(--color-fg)]">
        {subject}
      </h2>
      <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] italic">
        {preheader}
      </p>

      {/* Test-send row */}
      <div className="mt-5 border-t border-[color:var(--color-line)] pt-5">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
          Step 1 · Send a test to yourself
        </div>
        <div className="flex items-stretch gap-2 flex-wrap">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 min-w-[220px] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[13px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={
              !testEmail.trim() ||
              (state.kind === "sending" && state.mode === "test")
            }
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] disabled:opacity-40 transition"
          >
            {state.kind === "sending" && state.mode === "test"
              ? "Sending…"
              : "Send test"}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            {showPreview ? "Hide preview" : "Preview email"}
          </button>
        </div>
      </div>

      {/* Send-all row */}
      <div className="mt-5 border-t border-[color:var(--color-line)] pt-5">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
          Step 2 · Send to all subscribers
        </div>
        {leads.length === 0 ? (
          <p className="text-[13px] text-[color:var(--color-fg-faint)] leading-relaxed">
            No subscribers in <code className="font-mono text-[12px] text-[color:var(--color-fg-dim)]">data/output/report_leads.jsonl</code> yet.
          </p>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={sendAll}
              disabled={state.kind === "sending" && state.mode === "all"}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded text-[#1a0c00] hover:opacity-90 disabled:opacity-40 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              {state.kind === "sending" && state.mode === "all"
                ? "Sending…"
                : confirmAll
                  ? `Confirm — send to ${leads.length}`
                  : `Send to ${leads.length} subscriber${leads.length === 1 ? "" : "s"} ⚡`}
            </button>
            {confirmAll && (
              <button
                type="button"
                onClick={() => setConfirmAll(false)}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
              >
                Cancel
              </button>
            )}
            <span className="text-[12px] text-[color:var(--color-fg-faint)]">
              {confirmAll
                ? "This actually sends. Make sure you ran a test first."
                : "Two clicks — the first arms, the second sends."}
            </span>
          </div>
        )}
      </div>

      {/* Status row */}
      {state.kind === "ok" && (
        <div className="mt-5 rounded-lg border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] px-4 py-3 text-[13px] text-[color:var(--color-success)] leading-relaxed">
          ✓ {state.mode === "test" ? "Test sent." : "Digest sent."}
          {" "}
          {state.sent} delivered{state.failed > 0 ? `, ${state.failed} failed` : ""}.
          {" "}
          <span className="text-[color:var(--color-fg-dim)]">
            Subject: <span className="font-mono text-[12px]">{state.subject}</span>
          </span>
        </div>
      )}
      {state.kind === "disabled" && (
        <div className="mt-5 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-4 py-3 text-[13px] text-[color:var(--color-warn)]">
          Sending needs <code className="font-mono text-[12px]">RESEND_API_KEY</code> on the server.
          Set it in <code className="font-mono text-[12px]">.env.local</code> or Vercel env vars and reload.
        </div>
      )}
      {state.kind === "error" && (
        <div className="mt-5 rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-[13px] text-[color:var(--color-danger)]">
          Send failed: {state.message}
        </div>
      )}

      {/* Preview iframe */}
      {showPreview && (
        <div className="mt-5 rounded-lg border border-[color:var(--color-line)] overflow-hidden bg-white">
          <iframe
            srcDoc={html}
            title="Weekly digest preview"
            sandbox=""
            className="w-full"
            style={{ height: 720, border: 0, background: "#0a0a0a" }}
          />
        </div>
      )}
    </section>
  );
}
