"use client";

import { useState } from "react";
import type { SubscriberPlan } from "@/lib/subscribers";

type SendState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "disabled"; message: string }
  | { kind: "error"; message: string };

export function SubscribeButton({
  plan,
  label,
  featured,
}: {
  plan: SubscriberPlan;
  label: string;
  featured?: boolean;
}) {
  const [state, setState] = useState<SendState>({ kind: "idle" });

  const start = async () => {
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setState({ kind: "disabled", message: data.message || "Checkout not configured" });
        return;
      }
      if (!r.ok || data.error) {
        setState({ kind: "error", message: data.error || `HTTP ${r.status}` });
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setState({ kind: "error", message: "no checkout URL returned" });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={start}
        disabled={state.kind === "loading"}
        className={`w-full text-center px-4 py-2.5 rounded-md font-mono text-[11px] tracking-[0.18em] uppercase transition disabled:opacity-50 disabled:cursor-not-allowed ${
          featured
            ? "bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90"
            : "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
        }`}
      >
        {state.kind === "loading" ? "Redirecting…" : label}
      </button>
      {state.kind === "disabled" && (
        <p className="mt-2 text-[11px] text-[color:var(--color-warn)] leading-snug">
          {state.message}
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-2 text-[11px] text-[color:var(--color-danger)] leading-snug">
          {state.message}
        </p>
      )}
    </div>
  );
}
