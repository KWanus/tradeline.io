"use client";

import { useEffect, useState } from "react";

import type { DncEntry } from "@/lib/dnc-server";

const TOKEN_KEY = "tradeline.autopilot_token.v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DncDesk({ initialEntries }: { initialEntries: DncEntry[] }) {
  const [entries, setEntries] = useState<DncEntry[]>(initialEntries);
  const [token, setToken] = useState("");
  const [tokenStored, setTokenStored] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(TOKEN_KEY);
      if (t) {
        setToken(t);
        setTokenStored(true);
      }
    } catch {}
  }, []);

  const persistToken = (t: string) => {
    setToken(t);
    try {
      window.localStorage.setItem(TOKEN_KEY, t);
      setTokenStored(true);
    } catch {}
  };

  const mutate = async (action: "add" | "remove", addr: string, why?: string) => {
    if (!token) return setError("Paste your CRON_SECRET to authorize.");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, email: addr, reason: why }),
      });
      const data = (await r.json()) as { entries?: DncEntry[]; error?: string };
      if (!r.ok) {
        setError(data.error || `HTTP ${r.status}`);
        if (r.status === 401) setTokenStored(false);
      } else if (data.entries) {
        setEntries(data.entries);
        if (action === "add") {
          setEmail("");
          setReason("");
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const add = () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setError("Enter a valid email.");
    mutate("add", e, reason.trim() || undefined);
  };

  return (
    <div className="space-y-6">
      {!tokenStored && (
        <section className="card-elevated p-5">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            One-time setup · auth token
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Editing the suppression list is gated by your <code>CRON_SECRET</code>{" "}
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

      {/* Add form */}
      <section className="card p-5">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
          Suppress an address
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="flex-1 min-w-[220px]">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@firm.com"
              className="mt-1 w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px]"
            />
          </label>
          <label className="flex-1 min-w-[180px]">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Reason (optional)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="asked to stop"
              className="mt-1 w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px]"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={!tokenStored || busy}
            className="btn-primary disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] text-[color:var(--color-danger)]">{error}</p>}
      </section>

      {/* List */}
      <section>
        <h3 className="text-[14px] font-semibold text-[color:var(--color-fg)] mb-2">
          Suppressed
          <span className="ml-2 font-mono text-[12px] text-[color:var(--color-fg-faint)]">
            {entries.length}
          </span>
        </h3>
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-6 text-[13px] text-[color:var(--color-fg-dim)]">
            No suppressed addresses. Anyone who replies asking to stop — or whom
            you opt out from the Replies inbox — lands here.
          </div>
        ) : (
          <ul className="space-y-1">
            {entries.map((e) => (
              <li
                key={e.email}
                className="flex items-center gap-3 text-[13px] px-3 py-2.5 rounded-md border border-[color:var(--color-line)]"
              >
                <span className="font-mono text-[color:var(--color-fg)] truncate min-w-0 flex-1">
                  {e.email}
                </span>
                <span className="text-[12px] text-[color:var(--color-fg-dim)] truncate hidden sm:block">
                  {e.reason}
                </span>
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-fg-faint)] hidden md:block">
                  {e.addedAt ? new Date(e.addedAt).toLocaleDateString() : ""}
                </span>
                <button
                  type="button"
                  onClick={() => mutate("remove", e.email)}
                  disabled={!tokenStored || busy}
                  className="font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
