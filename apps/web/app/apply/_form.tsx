"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const ROLE_OPTIONS = [
  { value: "buyer", label: "Licensed debt buyer (or in license process)" },
  { value: "broker", label: "Broker / loan-sale advisor" },
  { value: "lender", label: "Hypothecation lender" },
  { value: "attorney", label: "Consumer-finance attorney" },
  { value: "cpa", label: "Receivables-specialty CPA" },
  { value: "founder", label: "Founder/operator at a related business" },
  { value: "other", label: "Other" },
];

const VOLUME_OPTIONS = [
  { value: "pre", label: "Not buying yet — getting licensed" },
  { value: "lt1m", label: "Under $1M face / month" },
  { value: "1to5m", label: "$1M–$5M face / month" },
  { value: "5to25m", label: "$5M–$25M face / month" },
  { value: "25mplus", label: "$25M+ face / month" },
  { value: "na", label: "Not a buyer (broker / lender / attorney / CPA)" },
];

export function ApplyForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [role, setRole] = useState("buyer");
  const [state, setState] = useState("");
  const [volume, setVolume] = useState("lt1m");
  const [interest, setInterest] = useState("");
  const [referral, setReferral] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim() || !firm.trim()) return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      const r = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          firm: firm.trim(),
          role,
          state: state.trim(),
          volume,
          interest: interest.trim(),
          referral: referral.trim(),
        }),
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
      <div className="rounded-xl border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] p-6 md:p-8">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-success)]">
          Application received
        </div>
        <h2 className="mt-3 font-serif text-2xl tracking-tight">
          Thanks, {name.split(" ")[0] || "there"}.
        </h2>
        <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          We&rsquo;ll get back to you within 2-3 business days at{" "}
          <span className="font-mono text-[13px] text-[color:var(--color-fg)]">
            {email}
          </span>
          . If you don&rsquo;t hear from us within a week, check spam first,
          then send a follow-up to{" "}
          <a
            className="text-[color:var(--color-accent)] hover:underline"
            href="mailto:kwanusmrket@gmail.com?subject=Tradeline%20design%20partner%20follow-up"
          >
            kwanusmrket@gmail.com
          </a>
          .
        </p>
        <p className="mt-3 text-[13px] text-[color:var(--color-fg-faint)]">
          Meanwhile, you should already be on the weekly. Subscribe at{" "}
          <a
            href="/report"
            className="text-[color:var(--color-accent)] hover:underline"
          >
            /report
          </a>{" "}
          if you aren&rsquo;t yet.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 md:p-8 space-y-5"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Your name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className="input"
          />
        </Field>
        <Field label="Work email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="input"
            placeholder="you@firm.com"
          />
        </Field>
        <Field label="Firm" required>
          <input
            type="text"
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
            required
            className="input"
            placeholder="Acme Capital LLC"
          />
        </Field>
        <Field label="Primary state of operation">
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="input"
            placeholder="MD"
            maxLength={64}
          />
        </Field>
      </div>

      <Field label="Your role">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="input"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Current monthly NPL volume">
        <select
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          className="input"
        >
          {VOLUME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="What do you want from Tradeline?"
        hint="One or two sentences. Specific is better than vague."
      >
        <textarea
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          rows={3}
          className="input"
          placeholder="e.g. 'I need earlier signal on Mid-Atlantic regional banks before NLEX postings drop. Especially Tier-3 credit-card paper.'"
          maxLength={1000}
        />
      </Field>

      <Field
        label="How did you hear about Tradeline?"
        hint="Optional."
      >
        <input
          type="text"
          value={referral}
          onChange={(e) => setReferral(e.target.value)}
          className="input"
          placeholder="RMAI / LinkedIn / referral / search"
          maxLength={128}
        />
      </Field>

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button
          type="submit"
          disabled={
            status === "submitting" ||
            !email.trim() ||
            !name.trim() ||
            !firm.trim()
          }
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-2.5 rounded text-[#0a0c14] hover:opacity-90 disabled:opacity-40 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          {status === "submitting" ? "Submitting…" : "Apply for design partner"}
        </button>
        <span className="text-[12px] text-[color:var(--color-fg-faint)]">
          We&rsquo;ll respond within 2-3 business days.
        </span>
      </div>

      {status === "error" && errorMsg && (
        <p className="text-[13px] text-[color:var(--color-danger)]">{errorMsg}</p>
      )}

      <style>{`
        .input {
          width: 100%;
          background: var(--color-bg-2);
          border: 1px solid var(--color-line);
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 14px;
          color: var(--color-fg);
          transition: border-color 0.15s ease;
        }
        .input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
        .input::placeholder {
          color: var(--color-fg-faint);
        }
        textarea.input {
          resize: vertical;
          font-family: inherit;
          line-height: 1.5;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          {label}
          {required && (
            <span className="text-[color:var(--color-accent)] ml-1">*</span>
          )}
        </span>
        {hint && (
          <span className="text-[11px] text-[color:var(--color-fg-faint)] italic">
            {hint}
          </span>
        )}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
