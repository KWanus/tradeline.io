"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function ReportSubscribeForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("buyer");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      const r = await fetch("/api/report/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), type }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setStatus("error");
        setErrorMsg(data?.error || `HTTP ${r.status}`);
        return;
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message || "Network error");
    }
  }

  if (status === "success") {
    return (
      <div className="card p-6 border-[color:var(--color-accent-dim)]">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-accent)]">
          You&rsquo;re on the list
        </div>
        <p className="mt-2 text-[15px] text-[color:var(--color-fg)] leading-relaxed">
          First issue ships next Monday. If you don&rsquo;t see it, check your
          spam folder and move it to the inbox — that helps deliverability for
          everyone.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@firm.com"
          required
          autoComplete="email"
          className="bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2.5 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          autoComplete="name"
          className="bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2.5 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2.5 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        >
          <option value="buyer">I&rsquo;m a debt buyer (or want to be)</option>
          <option value="broker">I&rsquo;m a broker / loan-sale advisor</option>
          <option value="lender">I&rsquo;m a hypothecation lender</option>
          <option value="attorney">I&rsquo;m a consumer-finance attorney</option>
          <option value="cpa">I&rsquo;m a receivables-specialty CPA</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="btn-primary disabled:opacity-50"
        >
          {status === "submitting" ? "Subscribing…" : "Get the report"}
        </button>
      </div>
      {status === "error" && errorMsg && (
        <p className="text-[12px] text-[color:var(--color-danger)]">{errorMsg}</p>
      )}
      <p className="text-[11px] text-[color:var(--color-fg-faint)] leading-relaxed">
        Free. Unsubscribe anytime. We never sell your address.
      </p>
    </form>
  );
}
