"use client";

import { useEffect, useState } from "react";

import type { InboundReply } from "@/lib/replies";

// Same token key as Autopilot / Growth — authorize once.
const TOKEN_KEY = "tradeline.autopilot_token.v1";

const INTENT_LABEL: Record<string, { label: string; tone: string }> = {
  warm: { label: "Interested", tone: "success" },
  "has-tape": { label: "Has a tape", tone: "success" },
  "wants-info": { label: "Wants info", tone: "accent" },
  "tape-detail-request": { label: "Needs deal details", tone: "accent" },
  "needs-license": { label: "License question", tone: "warn" },
  "panel-only": { label: "Panel-only", tone: "warn" },
  passing: { label: "Passing", tone: "dim" },
  unclear: { label: "Unclear", tone: "dim" },
};

function toneClass(tone: string): string {
  return tone === "success"
    ? "text-[color:var(--color-success)] border-[color:var(--color-success-dim)]"
    : tone === "accent"
      ? "text-[color:var(--color-accent)] border-[color:var(--color-line-strong)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)] border-[color:var(--color-warn)]"
        : "text-[color:var(--color-fg-faint)] border-[color:var(--color-line)]";
}

export function RepliesDesk({ initialReplies }: { initialReplies: InboundReply[] }) {
  const [replies, setReplies] = useState<InboundReply[]>(initialReplies);
  const [token, setToken] = useState("");
  const [tokenStored, setTokenStored] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHandled, setShowHandled] = useState(false);

  // Read the stored token once on mount (client only).
  useEffect(() => {
    try {
      const t = window.localStorage.getItem(TOKEN_KEY);
      if (t) {
        setToken(t);
        setTokenStored(true);
      }
    } catch {}
  }, []);

  const refresh = async () => {
    try {
      const r = await fetch("/api/replies", { cache: "no-store" });
      const data = (await r.json()) as { replies: InboundReply[] };
      setReplies(data.replies || []);
    } catch {}
  };

  const persistToken = (t: string) => {
    setToken(t);
    try {
      window.localStorage.setItem(TOKEN_KEY, t);
      setTokenStored(true);
    } catch {}
  };

  const pending = replies.filter((r) => !r.handledAt);
  const handled = replies.filter((r) => r.handledAt);

  const markHandled = async (id: string, action: "handle" | "reopen") => {
    if (!token) return setError("Paste your CRON_SECRET to authorize.");
    setBusy(id);
    setError(null);
    try {
      const r = await fetch("/api/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      if (!r.ok) {
        const e = (await r.json()) as { error?: string };
        setError(e.error || `HTTP ${r.status}`);
        if (r.status === 401) setTokenStored(false);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  const sendReply = async (
    reply: InboundReply,
    subject: string,
    text: string
  ) => {
    if (!token) return setError("Paste your CRON_SECRET to authorize.");
    setBusy(reply.id);
    setError(null);
    try {
      const r = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: reply.fromEmail,
          subject,
          text,
          bankKey: reply.bankKey,
          bankName: reply.bankName,
        }),
      });
      const data = (await r.json()) as { sent?: boolean; enabled?: boolean; error?: string };
      if (data.enabled === false) {
        setError(data.error || "Sending is disabled — set RESEND_API_KEY on the server.");
        setBusy(null);
        return;
      }
      if (!r.ok || data.error) {
        setError(data.error || `HTTP ${r.status}`);
        setBusy(null);
        return;
      }
      // Sent — mark handled.
      await markHandled(reply.id, "handle");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const suppress = async (reply: InboundReply) => {
    if (!token) return setError("Paste your CRON_SECRET to authorize.");
    setBusy(reply.id);
    setError(null);
    try {
      await fetch("/api/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "add",
          email: reply.fromEmail,
          bankKey: reply.bankKey,
          reason: "opted out via reply",
        }),
      });
      await markHandled(reply.id, "handle");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {!tokenStored && (
        <section className="card-elevated p-5">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            One-time setup · auth token
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Sending and handling replies is gated by your <code>CRON_SECRET</code>{" "}
            (same token as Autopilot). Paste it once — stored locally.
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="CRON_SECRET (paste once)"
              className="flex-1 min-w-[260px] px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] font-mono"
            />
            <button
              type="button"
              onClick={() => token.trim() && persistToken(token.trim())}
              disabled={!token.trim()}
              className="btn-primary disabled:opacity-50"
            >
              Authorize
            </button>
          </div>
        </section>
      )}

      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-[18px] font-semibold text-[color:var(--color-fg)]">
          Waiting on you
          <span className="ml-2 font-mono text-[12px] text-[color:var(--color-fg-faint)]">
            {pending.length}
          </span>
        </h3>
        {handled.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHandled((s) => !s)}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-accent)] transition"
          >
            {showHandled ? "Hide" : "Show"} handled ({handled.length})
          </button>
        )}
      </div>

      {error && <p className="text-[12px] text-[color:var(--color-danger)]">{error}</p>}

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-6 text-[13px] text-[color:var(--color-fg-dim)]">
          Inbox zero. Replies land here automatically once your inbound-email
          webhook is pointed at <code>/api/inbound-reply</code>. Each one arrives
          classified, with a drafted response ready to approve.
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((reply) => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              busy={busy === reply.id}
              disabled={!tokenStored}
              onSend={(s, t) => sendReply(reply, s, t)}
              onHandle={() => markHandled(reply.id, "handle")}
              onSuppress={() => suppress(reply)}
            />
          ))}
        </div>
      )}

      {showHandled && handled.length > 0 && (
        <section>
          <h4 className="text-[14px] font-semibold text-[color:var(--color-fg)] mb-2">
            Handled
          </h4>
          <ul className="space-y-1">
            {handled.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 text-[12px] font-mono text-[color:var(--color-fg-dim)] px-3 py-2 rounded-md border border-[color:var(--color-line)]"
              >
                <span className="text-[color:var(--color-success)] min-w-[44px] uppercase tracking-[0.14em]">
                  done
                </span>
                <span className="text-[color:var(--color-fg)] truncate flex-1 min-w-0">
                  {r.fromName || r.fromEmail}
                </span>
                <span className="truncate hidden sm:block">{r.bankName || ""}</span>
                <button
                  type="button"
                  onClick={() => markHandled(r.id, "reopen")}
                  disabled={busy === r.id || !tokenStored}
                  className="text-[color:var(--color-accent)] hover:underline disabled:opacity-50"
                >
                  reopen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReplyCard({
  reply,
  busy,
  disabled,
  onSend,
  onHandle,
  onSuppress,
}: {
  reply: InboundReply;
  busy: boolean;
  disabled: boolean;
  onSend: (subject: string, text: string) => void;
  onHandle: () => void;
  onSuppress: () => void;
}) {
  const [subject, setSubject] = useState(
    reply.suggestedSubject || (reply.subject ? `Re: ${reply.subject}` : "Re: your note")
  );
  const [text, setText] = useState(reply.suggestedReply || "");
  const intent = INTENT_LABEL[reply.classification || "unclear"] || {
    label: "Reply",
    tone: "dim",
  };
  const received = new Date(reply.receivedAt);

  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-[15px] font-semibold text-[color:var(--color-fg)]">
              {reply.fromName || reply.fromEmail}
            </h4>
            <span
              className={`font-mono text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full border ${toneClass(intent.tone)}`}
            >
              {intent.label}
            </span>
          </div>
          <div className="mt-1 text-[12px] font-mono text-[color:var(--color-fg-dim)]">
            {reply.fromEmail}
            {reply.bankName ? ` · ${reply.bankName}` : ""}
            {` · ${received.toLocaleString()}`}
          </div>
        </div>
      </div>

      {reply.summary && (
        <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] italic">
          {reply.summary}
        </p>
      )}

      {/* Their message */}
      <div className="mt-3 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-3">
        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
          Their message
        </div>
        <pre className="whitespace-pre-wrap text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed font-sans">
          {reply.body}
        </pre>
      </div>

      {/* Your drafted reply */}
      <div className="mt-3">
        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
          Your reply (editable)
        </div>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-2 py-1.5 mb-2 rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[13px] font-semibold"
        />
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your reply…"
          className="w-full px-2 py-1.5 rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[13px] font-sans leading-relaxed"
        />
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onSend(subject, text)}
          disabled={disabled || busy || !text.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? "Sending…" : "Approve & send reply"}
        </button>
        <button
          type="button"
          onClick={onHandle}
          disabled={disabled || busy}
          className="px-3 py-2 rounded-full text-[12px] border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition disabled:opacity-50"
        >
          Mark handled
        </button>
        <button
          type="button"
          onClick={onSuppress}
          disabled={disabled || busy}
          className="ml-auto px-3 py-2 rounded-full text-[12px] border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition disabled:opacity-50"
          title="Add this address to the do-not-contact list and mark handled"
        >
          Opt out
        </button>
      </div>
    </div>
  );
}
