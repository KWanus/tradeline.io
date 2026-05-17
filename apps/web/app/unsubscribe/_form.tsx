"use client";

import { useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

const REASONS = [
  "Too frequent",
  "Not relevant to me",
  "Got what I needed",
  "Quality not high enough",
  "Didn't sign up",
  "Other",
];

export function UnsubscribeForm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [reason, setReason] = useState<string>("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "submitting" });
    try {
      const r = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, reason: reason || undefined }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setState({
          kind: "error",
          message: data?.error || `HTTP ${r.status}`,
        });
        return;
      }
      setState({ kind: "done" });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="rounded-xl border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] p-6 md:p-8">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-success)]">
          Unsubscribed
        </div>
        <h1 className="mt-3 font-serif text-3xl tracking-tight">
          You&rsquo;re off the list.
        </h1>
        <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          <span className="font-mono text-[13px] text-[color:var(--color-fg)]">
            {email}
          </span>{" "}
          will not receive any further Tradeline weekly emails. Took effect
          immediately.
        </p>
        <p className="mt-3 text-[13px] text-[color:var(--color-fg-faint)]">
          If you change your mind, sign up again at{" "}
          <a href="/report" className="text-[color:var(--color-accent)] hover:underline">
            /report
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-8"
    >
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
        Unsubscribe
      </div>
      <h1 className="mt-3 font-serif text-3xl tracking-tight">
        Confirm: stop the weekly?
      </h1>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        Unsubscribing{" "}
        <span className="font-mono text-[13px] text-[color:var(--color-fg)]">
          {email}
        </span>
        . You&rsquo;ll stop receiving the Tradeline weekly Charge-Off Report
        within seconds.
      </p>

      <div className="mt-6">
        <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Why? (optional — helps us)
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-2 w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2.5 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        >
          <option value="">— select a reason —</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={state.kind === "submitting"}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded text-[#1a0c00] hover:opacity-90 disabled:opacity-40 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          {state.kind === "submitting" ? "Unsubscribing…" : "Confirm unsubscribe"}
        </button>
        <a
          href="/report"
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
        >
          Stay subscribed
        </a>
      </div>

      {state.kind === "error" && (
        <p className="mt-4 text-[13px] text-[color:var(--color-danger)]">
          {state.message}
        </p>
      )}
    </form>
  );
}
