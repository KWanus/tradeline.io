"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// Same key the Autopilot panel uses, so the operator authorizes once.
const TOKEN_KEY = "tradeline.autopilot_token.v1";

type Segment =
  | "debt-buyer"
  | "broker"
  | "collection-agency"
  | "debt-settlement"
  | "law-firm"
  | "fund"
  | "other";

const SEGMENT_LABEL: Record<Segment, string> = {
  "debt-buyer": "Debt buyers / NPL funds",
  broker: "Receivables / debt brokers",
  "collection-agency": "Collection agencies",
  "debt-settlement": "Debt-settlement firms",
  "law-firm": "Creditors-rights law firms",
  fund: "Distressed-credit funds",
  other: "Adjacent businesses",
};

type Config = {
  enabled: boolean;
  autoApprove: boolean;
  dailyDiscoverTarget: number;
  dailyCap: number;
  segments: Segment[];
  geo: string;
  pausedReason: string | null;
};

type LeadStatus = "pending" | "approved" | "sent" | "skipped" | "failed";

type Lead = {
  id: string;
  firm: string;
  segment: Segment;
  contactName: string | null;
  email: string;
  website: string | null;
  sourceUrl: string | null;
  rationale: string;
  subject: string;
  body: string;
  status: LeadStatus;
  discoveredAt: string;
  sentAt: string | null;
  error: string | null;
};

type Store = { config: Config; leads: Lead[] };

export function GrowthDesk() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [tokenStored, setTokenStored] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/growth/queue", { cache: "no-store" });
      setStore((await r.json()) as Store);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(TOKEN_KEY);
      if (t) {
        setToken(t);
        setTokenStored(true);
      }
    } catch {}
    refresh();
  }, [refresh]);

  const persistToken = (t: string) => {
    setToken(t);
    try {
      window.localStorage.setItem(TOKEN_KEY, t);
      setTokenStored(true);
    } catch {}
  };

  const saveConfig = async (patch: Partial<Config>) => {
    if (!token) {
      setError("Paste your CRON_SECRET to authorize changes.");
      return;
    }
    setBusy("config");
    setError(null);
    try {
      const r = await fetch("/api/growth/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const e = (await r.json()) as { error?: string };
        setError(e.error || `HTTP ${r.status}`);
        if (r.status === 401) setTokenStored(false);
      } else {
        const data = (await r.json()) as { config: Config };
        setStore((s) => (s ? { ...s, config: data.config } : s));
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  const runDiscovery = async () => {
    if (!token) {
      setError("Paste your CRON_SECRET to authorize discovery.");
      return;
    }
    setDiscovering(true);
    setError(null);
    try {
      const r = await fetch("/api/growth/discover", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const e = (await r.json()) as { error?: string };
        setError(e.error || `HTTP ${r.status}`);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setDiscovering(false);
  };

  const act = async (
    id: string,
    action: "send" | "skip",
    overrides?: { subject?: string; body?: string }
  ) => {
    if (!token) {
      setError("Paste your CRON_SECRET to authorize.");
      return;
    }
    setBusy(id);
    setError(null);
    try {
      const r = await fetch("/api/growth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action, ...overrides }),
      });
      if (!r.ok) {
        const e = (await r.json()) as { error?: string };
        setError(e.error || `HTTP ${r.status}`);
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  const counts = useMemo(() => {
    const leads = store?.leads || [];
    return {
      pending: leads.filter((l) => l.status === "pending").length,
      sent: leads.filter((l) => l.status === "sent").length,
      skipped: leads.filter((l) => l.status === "skipped").length,
      failed: leads.filter((l) => l.status === "failed").length,
    };
  }, [store]);

  if (loading || !store) {
    return (
      <div className="card px-6 py-10 text-center text-[13px] text-[color:var(--color-fg-dim)]">
        Loading growth queue…
      </div>
    );
  }

  const cfg = store.config;
  const pending = store.leads.filter((l) => l.status === "pending");
  const history = store.leads
    .filter((l) => l.status !== "pending")
    .slice(0, 30);

  return (
    <div className="space-y-6">
      {/* Status */}
      <section
        className={`rounded-2xl p-6 ${
          cfg.enabled
            ? "bg-[color:var(--color-success-soft)] border border-[color:var(--color-success-dim)]"
            : "bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)]"
        }`}
      >
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Status
        </div>
        <h2 className="mt-2 text-[22px] md:text-[26px] font-semibold tracking-tight text-[color:var(--color-fg)]">
          {cfg.enabled
            ? cfg.autoApprove
              ? "Fully autonomous — finds & sends"
              : "Active — finds & queues for your approval"
            : "Not active"}
        </h2>
        <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          The engine searches the live web for businesses that would pay for
          Tradeline, drafts each email, and {cfg.autoApprove ? "sends up to your daily cap automatically." : "drops them below for one-tap approval."}{" "}
          When a prospect replies, it lands classified in your{" "}
          <Link href="/app/inbox/replies" className="text-[color:var(--color-accent)] underline">
            replies inbox
          </Link>{" "}
          with a drafted response ready to approve.
        </p>
        <div className="mt-4 flex gap-4 flex-wrap font-mono text-[12px]">
          <Stat label="Awaiting approval" value={counts.pending} tone="accent" />
          <Stat label="Sent" value={counts.sent} tone="success" />
          <Stat label="Skipped" value={counts.skipped} />
          <Stat label="Failed" value={counts.failed} tone={counts.failed ? "danger" : "dim"} />
        </div>
      </section>

      {/* Auth token */}
      {!tokenStored && (
        <section className="card-elevated p-5">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            One-time setup · auth token
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Approving and sending is gated by your <code>CRON_SECRET</code>{" "}
            (already in your Vercel env, same token as Autopilot). Paste it
            once — stored locally on this device.
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

      {/* Run + config */}
      <section className="card p-5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              Discovery
            </div>
            <h3 className="mt-1 text-[18px] font-semibold text-[color:var(--color-fg)]">
              Find prospects now
            </h3>
            <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
              Searches the web for {cfg.dailyDiscoverTarget} fresh firms and drafts each email.
            </p>
          </div>
          <button
            type="button"
            onClick={runDiscovery}
            disabled={!tokenStored || discovering}
            className="btn-primary disabled:opacity-50"
          >
            {discovering ? "Searching the web…" : "Run discovery"}
          </button>
        </div>

        {/* Geo + targets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Geography
            </span>
            <input
              type="text"
              defaultValue={cfg.geo}
              disabled={!tokenStored || busy === "config"}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== cfg.geo)
                  saveConfig({ geo: e.target.value.trim() });
              }}
              className="mt-1 w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Find / run: {cfg.dailyDiscoverTarget}
            </span>
            <input
              type="range"
              min={1}
              max={25}
              value={cfg.dailyDiscoverTarget}
              disabled={!tokenStored || busy === "config"}
              onChange={(e) => saveConfig({ dailyDiscoverTarget: Number(e.target.value) })}
              className="mt-3 w-full accent-[color:var(--color-accent)]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Daily send cap: {cfg.dailyCap}
            </span>
            <input
              type="range"
              min={0}
              max={50}
              value={cfg.dailyCap}
              disabled={!tokenStored || busy === "config"}
              onChange={(e) => saveConfig({ dailyCap: Number(e.target.value) })}
              className="mt-3 w-full accent-[color:var(--color-accent)]"
            />
          </label>
        </div>

        {/* Segments */}
        <div>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Who to hunt for
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(SEGMENT_LABEL) as Segment[]).map((s) => {
              const on = cfg.segments.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!tokenStored || busy === "config"}
                  onClick={() => {
                    const next = on
                      ? cfg.segments.filter((x) => x !== s)
                      : [...cfg.segments, s];
                    if (next.length === 0) return;
                    saveConfig({ segments: next });
                  }}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition ${
                    on
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-fg)]"
                      : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
                  } disabled:opacity-50`}
                >
                  {SEGMENT_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Switches */}
        <div className="flex flex-col gap-3 pt-1">
          <Switch
            label="Enabled"
            description="Master toggle. The scheduled discovery cron does nothing when off."
            checked={cfg.enabled}
            disabled={!tokenStored || busy === "config"}
            onChange={(v) => saveConfig({ enabled: v })}
          />
          <Switch
            label="Auto-send (full autopilot)"
            description={
              cfg.autoApprove
                ? "LIVE — discovered prospects are emailed automatically up to the daily cap. No approval step."
                : "Off — you approve every email before it sends (recommended)."
            }
            checked={cfg.autoApprove}
            disabled={!tokenStored || busy === "config"}
            onChange={(v) => saveConfig({ autoApprove: v })}
            warnWhenOn
          />
        </div>
        {error && (
          <p className="text-[11px] text-[color:var(--color-danger)]">{error}</p>
        )}
      </section>

      {/* Approval queue */}
      <section>
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-[18px] font-semibold text-[color:var(--color-fg)]">
            Approve &amp; send
            <span className="ml-2 font-mono text-[12px] text-[color:var(--color-fg-faint)]">
              {pending.length} waiting
            </span>
          </h3>
        </div>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-6 text-[13px] text-[color:var(--color-fg-dim)]">
            Nothing waiting. Hit <strong>Run discovery</strong> above to find and
            draft a fresh batch — then each one shows up here for a one-tap send.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                busy={busy === lead.id}
                disabled={!tokenStored}
                onSend={(o) => act(lead.id, "send", o)}
                onSkip={() => act(lead.id, "skip")}
              />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section>
          <h3 className="text-[14px] font-semibold text-[color:var(--color-fg)] mb-2">
            Recent activity
          </h3>
          <ul className="space-y-1">
            {history.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-3 text-[12px] font-mono text-[color:var(--color-fg-dim)] px-3 py-2 rounded-md border border-[color:var(--color-line)]"
              >
                <StatusPill status={l.status} />
                <span className="text-[color:var(--color-fg)] truncate min-w-0 flex-1">
                  {l.firm}
                </span>
                <span className="truncate hidden sm:block">{l.email}</span>
                {l.error && (
                  <span className="text-[color:var(--color-danger)] truncate">
                    {l.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Queue is stored in <code>growth-queue.json</code> on the data branch.
        Every email carries a CAN-SPAM footer (physical address + one-click
        unsubscribe). Unsubscribed addresses are suppressed at discovery and at
        send.
      </p>
    </div>
  );
}

function LeadCard({
  lead,
  busy,
  disabled,
  onSend,
  onSkip,
}: {
  lead: Lead;
  busy: boolean;
  disabled: boolean;
  onSend: (o?: { subject?: string; body?: string }) => void;
  onSkip: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(lead.subject);
  const [body, setBody] = useState(lead.body);

  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-[15px] font-semibold text-[color:var(--color-fg)]">
              {lead.firm}
            </h4>
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)]">
              {SEGMENT_LABEL[lead.segment]}
            </span>
          </div>
          <div className="mt-1 text-[12px] font-mono text-[color:var(--color-fg-dim)]">
            {lead.contactName ? `${lead.contactName} · ` : ""}
            {lead.email}
            {lead.website ? (
              <>
                {" · "}
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-accent)] underline"
                >
                  site
                </a>
              </>
            ) : null}
            {lead.sourceUrl ? (
              <>
                {" · "}
                <a
                  href={lead.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-accent)] underline"
                >
                  source
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {lead.rationale && (
        <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] italic">
          Why them: {lead.rationale}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-3">
        {editing ? (
          <>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2 py-1.5 mb-2 rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[13px] font-semibold"
            />
            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[13px] font-mono leading-relaxed"
            />
          </>
        ) : (
          <>
            <div className="text-[13px] font-semibold text-[color:var(--color-fg)]">
              {subject}
            </div>
            <pre className="mt-2 whitespace-pre-wrap text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed font-sans">
              {body}
            </pre>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onSend(editing ? { subject, body } : undefined)}
          disabled={disabled || busy}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? "Sending…" : "Approve & send"}
        </button>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          disabled={disabled || busy}
          className="px-3 py-2 rounded-full text-[12px] border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition disabled:opacity-50"
        >
          {editing ? "Done editing" : "Edit"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled || busy}
          className="ml-auto px-3 py-2 rounded-full text-[12px] border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "dim",
}: {
  label: string;
  value: number;
  tone?: "accent" | "success" | "danger" | "dim";
}) {
  const color =
    tone === "accent"
      ? "text-[color:var(--color-accent)]"
      : tone === "success"
        ? "text-[color:var(--color-success)]"
        : tone === "danger"
          ? "text-[color:var(--color-danger)]"
          : "text-[color:var(--color-fg)]";
  return (
    <div>
      <span className={`text-[18px] font-semibold ${color}`}>{value}</span>{" "}
      <span className="text-[color:var(--color-fg-faint)]">{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, { t: string; c: string }> = {
    pending: { t: "queued", c: "text-[color:var(--color-fg-faint)]" },
    approved: { t: "approved", c: "text-[color:var(--color-accent)]" },
    sent: { t: "sent", c: "text-[color:var(--color-success)]" },
    skipped: { t: "skipped", c: "text-[color:var(--color-fg-faint)]" },
    failed: { t: "failed", c: "text-[color:var(--color-danger)]" },
  };
  const m = map[status];
  return (
    <span className={`min-w-[56px] tracking-[0.16em] uppercase ${m.c}`}>{m.t}</span>
  );
}

function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
  warnWhenOn,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  warnWhenOn?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[color:var(--color-fg)]">
          {label}
        </div>
        <div
          className={`text-[12px] leading-relaxed ${
            warnWhenOn && checked
              ? "text-[color:var(--color-warn)]"
              : "text-[color:var(--color-fg-dim)]"
          }`}
        >
          {description}
        </div>
      </div>
    </label>
  );
}
