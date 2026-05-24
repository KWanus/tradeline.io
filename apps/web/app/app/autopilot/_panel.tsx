"use client";

import { useEffect, useState } from "react";

const TOKEN_KEY = "tradeline.autopilot_token.v1";

type Audience = "sec" | "fdic" | "ncua";

type State = {
  enabled: boolean;
  dryRun: boolean;
  dailyCap: number;
  audiences: Audience[];
  customTemplate: string | null;
  pausedReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  sec: "SEC-listed banks",
  fdic: "FDIC community banks",
  ncua: "NCUA credit unions",
};

export function AutopilotPanel() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [tokenStored, setTokenStored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(TOKEN_KEY);
      if (t) {
        setToken(t);
        setTokenStored(true);
      }
    } catch {}
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/autopilot/config");
      const data = (await r.json()) as State;
      setState(data);
    } catch {}
    setLoading(false);
  };

  const persistToken = (t: string) => {
    setToken(t);
    try {
      window.localStorage.setItem(TOKEN_KEY, t);
      setTokenStored(true);
    } catch {}
  };

  const update = async (patch: Partial<State> | { action: "pause" | "resume" }) => {
    if (!token) {
      setSaveError("Paste your CRON_SECRET above to authorize changes.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/autopilot/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const err = (await r.json()) as { error?: string };
        setSaveError(err.error || `HTTP ${r.status}`);
        if (r.status === 401) {
          // Clear bad token so the user can re-enter.
          setTokenStored(false);
        }
      } else {
        const data = (await r.json()) as State;
        setState(data);
      }
    } catch (err) {
      setSaveError((err as Error).message);
    }
    setSaving(false);
  };

  if (loading || !state) {
    return (
      <div className="card px-6 py-10 text-center text-[13px] text-[color:var(--color-fg-dim)]">
        Loading autopilot state…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <section
        className={`rounded-2xl p-6 ${
          state.pausedReason
            ? "bg-[color:var(--color-warn-soft)] border border-[color:var(--color-warn)]"
            : state.enabled
              ? "bg-[color:var(--color-success-soft)] border border-[color:var(--color-success-dim)]"
              : "bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)]"
        }`}
      >
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Status
        </div>
        <h2 className="mt-2 text-[22px] md:text-[26px] font-semibold tracking-tight text-[color:var(--color-fg)]">
          {state.pausedReason
            ? `Paused — ${state.pausedReason}`
            : state.enabled
              ? state.dryRun
                ? "Running in dry-run (no emails sent)"
                : "Live — shipping daily"
              : "Not active"}
        </h2>
        <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {state.enabled
            ? `Next batch fires at 09:00 EDT Mon–Fri. Cap: ${state.dailyCap}/day. Audiences: ${state.audiences.map((a) => AUDIENCE_LABEL[a]).join(", ")}.`
            : "Configure the dials below and toggle Enabled to start. Default is dry-run for safety."}
        </p>
        {state.lastLoginAt && (
          <p className="mt-1 text-[11px] text-[color:var(--color-fg-faint)] font-mono">
            Last operator check-in: {new Date(state.lastLoginAt).toLocaleString()}
          </p>
        )}
      </section>

      {/* Auth token */}
      {!tokenStored && (
        <section className="card-elevated p-5">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            One-time setup · auth token
          </div>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Autopilot config changes are gated by your <code>CRON_SECRET</code>{" "}
            (already in your Vercel env). Paste it once — stored locally on this
            device so subsequent changes are seamless.
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

      {/* Daily cap slider */}
      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              Daily cap
            </div>
            <h3 className="mt-1 text-[18px] font-semibold text-[color:var(--color-fg)]">
              Up to <span className="text-[color:var(--color-accent)]">{state.dailyCap}</span> emails per weekday
            </h3>
          </div>
          <div className="text-[11px] font-mono text-[color:var(--color-fg-faint)]">
            5 = gentle warmup · 10 = default · 20 = max
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={state.dailyCap}
          onChange={(e) => update({ dailyCap: Number(e.target.value) })}
          disabled={!tokenStored || saving}
          className="w-full mt-4 accent-[color:var(--color-accent)]"
        />
      </section>

      {/* Audiences */}
      <section className="card p-5">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Audiences
        </div>
        <h3 className="mt-1 text-[18px] font-semibold text-[color:var(--color-fg)]">
          Which queues to pull from
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => {
            const on = state.audiences.includes(a);
            return (
              <label
                key={a}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition ${
                  on
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] hover:border-[color:var(--color-line-strong)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!tokenStored || saving}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...state.audiences, a]))
                      : state.audiences.filter((x) => x !== a);
                    if (next.length === 0) return; // must keep at least 1
                    update({ audiences: next });
                  }}
                />
                <span className="text-[13px] text-[color:var(--color-fg)]">
                  {AUDIENCE_LABEL[a]}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Advanced — custom template */}
      <section className="card p-5">
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="w-full flex items-center justify-between text-left"
        >
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
              Advanced
            </div>
            <h3 className="mt-1 text-[18px] font-semibold text-[color:var(--color-fg)]">
              Custom outreach template
            </h3>
            <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)]">
              {state.customTemplate
                ? "Custom template active. Click to edit."
                : "Using auto-generated per-bank drafts. Click to override."}
            </p>
          </div>
          <span
            className={`font-mono text-[14px] text-[color:var(--color-fg-faint)] transition-transform ${
              showAdvanced ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>
        {showAdvanced && (
          <div className="mt-4">
            <textarea
              rows={10}
              defaultValue={state.customTemplate || ""}
              placeholder={`Use [YOUR_NAME], [FIRM], [STATE], [ASSET_FOCUS] placeholders.\n\nLeave blank to use auto-generated per-bank drafts.`}
              className="w-full px-3 py-3 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] font-mono text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)]"
              onBlur={(e) => {
                if (e.target.value !== (state.customTemplate || "")) {
                  update({ customTemplate: e.target.value });
                }
              }}
              disabled={!tokenStored || saving}
            />
            <p className="mt-2 text-[11px] text-[color:var(--color-fg-faint)]">
              Saved on blur. Empty value reverts to defaults.
            </p>
          </div>
        )}
      </section>

      {/* Master switches */}
      <section className="card-elevated p-5">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          Switches
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <SwitchRow
            label="Enabled"
            description="Master toggle. Cron does nothing when off."
            checked={state.enabled}
            disabled={!tokenStored || saving}
            onChange={(v) => update({ enabled: v })}
          />
          <SwitchRow
            label="Dry-run mode"
            description={
              state.dryRun
                ? "Composing + logging only. No emails actually sent. Flip off when you trust the previews."
                : "LIVE — emails are being sent to real bank inboxes."
            }
            checked={state.dryRun}
            disabled={!tokenStored || saving}
            onChange={(v) => update({ dryRun: v })}
            warnWhenOff
          />
        </div>
        {state.pausedReason ? (
          <button
            type="button"
            onClick={() => update({ action: "resume" })}
            disabled={!tokenStored || saving}
            className="mt-4 btn-primary"
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => update({ action: "pause" })}
            disabled={!tokenStored || saving}
            className="mt-4 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-warn)] text-[color:var(--color-warn)] hover:bg-[color:var(--color-warn-soft)] transition disabled:opacity-50"
          >
            Pause
          </button>
        )}
        {saveError && (
          <p className="mt-3 text-[11px] text-[color:var(--color-danger)]">
            {saveError}
          </p>
        )}
      </section>

      <p className="text-[11px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        Configuration is stored in <code>autopilot-state.json</code> on the
        data branch (alongside radar_snapshot.json). Send log:{" "}
        <code>autopilot-log.json</code>. Both readable publicly; writes
        require your CRON_SECRET.
      </p>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  warnWhenOff,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  warnWhenOff?: boolean;
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
            warnWhenOff && !checked
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
