"use client";

import { useState } from "react";
import { useBuyerProfile } from "@/lib/buyer-profile";
import { buildAiUserContext } from "@/lib/ai-context";

type Classification = {
  classification: string;
  summary: string;
  urgency: "now" | "today" | "this-week" | "no-action";
  suggested_action: string;
  reply_subject: string;
  reply_body: string;
};

const CLASS_COPY: Record<string, { label: string; tone: string }> = {
  warm: {
    label: "Warm — they're interested",
    tone: "text-[color:var(--color-success)] border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]",
  },
  passing: {
    label: "Passing — polite no",
    tone: "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]",
  },
  "panel-only": {
    label: "Panel-only — ask path to panel",
    tone: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  },
  "wants-info": {
    label: "Wants your buyer profile",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)]",
  },
  "has-tape": {
    label: "Has a tape — open Tape Copilot",
    tone: "text-[color:var(--color-success)] border-[color:var(--color-success)] bg-[color:var(--color-success-soft)]",
  },
  "tape-detail-request": {
    label: "Asking firm details before tape",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  },
  "needs-license": {
    label: "Needs your state license",
    tone: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  },
  unclear: {
    label: "Unclear — ask a clarifier",
    tone: "text-[color:var(--color-fg-dim)] border-[color:var(--color-line)]",
  },
};

const URGENCY_COPY: Record<Classification["urgency"], string> = {
  now: "Reply within the hour. They're engaged.",
  today: "Reply today. Keep the thread warm.",
  "this-week": "Reply within a few days.",
  "no-action": "No urgent action — file the response.",
};

export function BrokerReplyClassifier({
  ticker,
  bankName,
  signalLabel,
}: {
  ticker: string;
  bankName: string;
  signalLabel: string;
}) {
  const [profile] = useBuyerProfile();
  const [reply, setReply] = useState("");
  const [result, setResult] = useState<Classification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    if (!reply.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const userContext = buildAiUserContext(profile, {
        ticker,
        bank: bankName,
        signal: signalLabel,
        yoy: null,
      });
      const bankContext = `Bank: ${bankName} (${ticker}). Signal that prompted outreach: ${signalLabel}.`;
      const r = await fetch("/api/classify-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerReply: reply, userContext, bankContext }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setError("AI classifier disabled — set ANTHROPIC_API_KEY on the server.");
        return;
      }
      if (!r.ok) {
        setError(data?.error || `HTTP ${r.status}`);
        return;
      }
      setResult({
        classification: data.classification,
        summary: data.summary,
        urgency: data.urgency,
        suggested_action: data.suggested_action,
        reply_subject: data.reply_subject,
        reply_body: data.reply_body,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyReply = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${result.reply_subject}\n\n${result.reply_body}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const mailto = result
    ? `mailto:?subject=${encodeURIComponent(result.reply_subject)}&body=${encodeURIComponent(result.reply_body)}`
    : "";

  const classInfo = result ? CLASS_COPY[result.classification] || CLASS_COPY.unclear : null;

  return (
    <section className="mt-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Got a reply? Paste it · AI tells you what to do
          </div>
          <h3 className="mt-1 font-semibold text-xl text-[color:var(--color-fg)]">
            Broker reply classifier
          </h3>
        </div>
        <span className="text-[color:var(--color-fg-faint)] font-mono text-[14px]">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="mt-5 space-y-4">
          <p className="text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Paste anything the broker sent back — one line or a paragraph.
            Tradeline AI reads the tone, tells you what they&rsquo;re saying, how
            urgent it is, and drafts your response. Then you copy or send.
          </p>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder='Paste broker reply here…  e.g. "Hi, thanks for reaching out. Not sure we have current paper from WAL but happy to keep you on the distribution list. What ticket size are you typically looking at?"'
            rows={5}
            className="w-full bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition resize-y"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={submit}
              disabled={loading || !reply.trim()}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded-full text-[#0a0c14] hover:opacity-90 disabled:opacity-40 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              {loading ? "Analyzing…" : "Classify + draft response"}
            </button>
            {reply && (
              <button
                type="button"
                onClick={() => {
                  setReply("");
                  setResult(null);
                  setError(null);
                }}
                className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
              >
                Clear
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-bg-soft)] p-3 text-[13px] text-[color:var(--color-danger)]">
              {error}
            </div>
          )}

          {result && classInfo && (
            <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4 space-y-4">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span
                  className={`font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 rounded border ${classInfo.tone}`}
                >
                  {classInfo.label}
                </span>
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  {URGENCY_COPY[result.urgency]}
                </span>
              </div>
              <p className="text-[13px] text-[color:var(--color-fg-dim)]">
                <span className="text-[color:var(--color-fg-faint)]">Summary: </span>
                {result.summary}
              </p>
              <p className="text-[13px] text-[color:var(--color-fg)] leading-snug">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mr-1.5">
                  Do
                </span>
                {result.suggested_action}
              </p>
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
                  Your draft reply
                </div>
                <div className="rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-3">
                  <div className="font-mono text-[11px] text-[color:var(--color-fg-dim)] mb-2">
                    <span className="text-[color:var(--color-fg-faint)]">Subject:</span>{" "}
                    {result.reply_subject}
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[12px] text-[color:var(--color-fg)] leading-relaxed">
                    {result.reply_body}
                  </pre>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={copyReply}
                      className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                    >
                      {copied ? "Copied ✓" : "Copy reply"}
                    </button>
                    <a
                      href={mailto}
                      className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
                    >
                      Open in mail ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
