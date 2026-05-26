"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBuyerProfile } from "@/lib/buyer-profile";
import { readTotalCapital, writeTotalCapital } from "@/lib/capital";
import {
  licenseStatus,
  readLicenses,
  writeLicenses,
  type License,
  type LicenseType,
} from "@/lib/compliance-licenses";
import {
  DEFAULT_CONCENTRATION_POLICY,
  readConcentrationPolicy,
  writeConcentrationPolicy,
} from "@/lib/tape-concentration-policy";
import { ALL_US_STATES, NO_LICENSE_REQUIRED_STATES } from "@/lib/tape-license-map";
import { logAction } from "@/lib/activity-log";

// "Get your operator OS configured" — one-shot setup card that writes the
// three required stores (compliance licenses, capital config, concentration
// policy) so the spine lights up on first run. Auto-hides once configured.
//
// Reads the existing buyer profile to seed: primary licensed state, license
// number, bond carrier, bond amount. The operator confirms / adds states
// + capital total in 30 seconds and the urgent queue, bid envelope, license
// gap analysis, and Tape Copilot license card all start working.

function newId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Default expiration when seeded from buyer profile (operator confirms / edits
// at /app/compliance after). 2 years out so we don't immediately fire an
// expiry warning on a freshly-seeded license.
function defaultExpiryISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type SetupState = {
  hasLicenses: boolean;
  hasCapital: boolean;
  hasConcentration: boolean;
  allConfigured: boolean;
};

function readSetupState(): SetupState {
  const licenses = readLicenses();
  const activeLicenses = licenses.filter((l) => licenseStatus(l) !== "expired").length;
  const cap = readTotalCapital();
  const conc = readConcentrationPolicy();
  const hasLicenses = activeLicenses > 0;
  const hasCapital = cap > 0;
  const hasConcentration = conc !== null;
  return {
    hasLicenses,
    hasCapital,
    hasConcentration,
    allConfigured: hasLicenses && hasCapital && hasConcentration,
  };
}

export function OsSetupCard() {
  const [profile] = useBuyerProfile();
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<SetupState>({
    hasLicenses: false,
    hasCapital: false,
    hasConcentration: false,
    allConfigured: true, // assume true until we hydrate to avoid flash
  });
  const [expanded, setExpanded] = useState(false);

  // Form inputs
  const [capitalDraft, setCapitalDraft] = useState<string>("");
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [licenseType, setLicenseType] = useState<LicenseType>("Both");
  const [maxState, setMaxState] = useState<string>(
    String(DEFAULT_CONCENTRATION_POLICY.maxPctPerState ?? 25)
  );
  const [maxVintage, setMaxVintage] = useState<string>(
    String(DEFAULT_CONCENTRATION_POLICY.maxPctPerVintage ?? 35)
  );
  const [maxAsset, setMaxAsset] = useState<string>(
    String(DEFAULT_CONCENTRATION_POLICY.maxPctPerAssetClass ?? 60)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(readSetupState());
    setHydrated(true);
  }, []);

  // Seed selected states from profile.state + the no-license-required list
  // (preselected as a charitable default — operator can de-select before save).
  useEffect(() => {
    if (!hydrated) return;
    const initial = new Set<string>();
    const primary = profile.state?.trim().toUpperCase();
    if (primary && /^[A-Z]{2}$/.test(primary)) initial.add(primary);
    for (const s of NO_LICENSE_REQUIRED_STATES) initial.add(s);
    setSelectedStates(initial);
  }, [hydrated, profile.state]);

  const missingCount = useMemo(() => {
    let n = 0;
    if (!state.hasLicenses) n++;
    if (!state.hasCapital) n++;
    if (!state.hasConcentration) n++;
    return n;
  }, [state]);

  function toggleState(code: string) {
    setSelectedStates((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectAll() {
    setSelectedStates(new Set(ALL_US_STATES.map((s) => s.code)));
  }

  function clearAll() {
    setSelectedStates(new Set());
  }

  function save() {
    setSaving(true);
    setError(null);
    try {
      // Validate capital
      const capUsd = Number(capitalDraft.replace(/[,$\s]/g, ""));
      if (!Number.isFinite(capUsd) || capUsd <= 0) {
        setError("Enter a total capital amount greater than 0.");
        setSaving(false);
        return;
      }

      // Validate selected states (allow empty = "no states declared yet")
      // but warn the operator visually that license shield will block everything.
      const states = Array.from(selectedStates).sort();

      // Validate concentration limits
      const maxStateN = Number(maxState);
      const maxVintageN = Number(maxVintage);
      const maxAssetN = Number(maxAsset);
      const validLimit = (n: number) => Number.isFinite(n) && n > 0 && n <= 100;
      if (
        !validLimit(maxStateN) ||
        !validLimit(maxVintageN) ||
        !validLimit(maxAssetN)
      ) {
        setError("Concentration limits must be between 1 and 100.");
        setSaving(false);
        return;
      }

      // 1. Write capital
      writeTotalCapital(capUsd);

      // 2. Write compliance licenses — seed from profile for the primary
      //    state with rich detail; lighter records for additional selected
      //    states. Operator confirms at /app/compliance.
      const existing = readLicenses();
      const existingByState = new Set(existing.map((l) => l.state.toUpperCase()));
      const now = new Date().toISOString();
      const newLicenses: License[] = [];
      const primary = profile.state?.trim().toUpperCase();
      for (const s of states) {
        if (existingByState.has(s)) continue; // don't overwrite operator-edited records
        if (s === primary) {
          newLicenses.push({
            id: newId(),
            state: s,
            licenseType,
            licenseNumber: profile.licenseNumber || "",
            issueDate: todayISO(),
            expirationDate: defaultExpiryISO(),
            bondAmountUsd: Number(profile.bondAmount?.replace(/[,$\s]/g, "")) || 0,
            suretyCarrier: profile.bondCarrier || "",
            annualFeeUsd: 0,
            notes: "Seeded from /app/welcome OS setup — confirm details at /app/compliance.",
            createdAt: now,
            updatedAt: now,
          });
        } else {
          newLicenses.push({
            id: newId(),
            state: s,
            licenseType,
            licenseNumber: NO_LICENSE_REQUIRED_STATES.includes(s)
              ? "(no license required)"
              : "",
            issueDate: todayISO(),
            expirationDate: defaultExpiryISO(),
            bondAmountUsd: 0,
            suretyCarrier: "",
            annualFeeUsd: 0,
            notes: NO_LICENSE_REQUIRED_STATES.includes(s)
              ? "No state license required per public licensing guides. Seeded from /app/welcome OS setup."
              : "Seeded from /app/welcome OS setup — confirm details at /app/compliance.",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      if (newLicenses.length > 0) {
        writeLicenses([...newLicenses, ...existing]);
      }

      // 3. Write concentration policy
      writeConcentrationPolicy({
        maxPctPerState: maxStateN,
        maxPctPerVintage: maxVintageN,
        maxPctPerAssetClass: maxAssetN,
        notes: "Seeded from /app/welcome OS setup.",
        lastUpdated: now,
      });

      // Log to activity feed so briefing/tutor see day-1 setup
      logAction({
        type: "os_setup_completed",
        pillar: "compliance",
        summary: `Configured operator OS — ${states.length} state${states.length === 1 ? "" : "s"} licensed (${licenseType}), capital ${(capUsd / 1000).toFixed(0)}k, concentration state≤${maxStateN}%/vintage≤${maxVintageN}%/asset≤${maxAssetN}%`,
        deepLink: "/app/compliance",
        meta: {
          stateCount: states.length,
          licenseType,
          capitalUsd: capUsd,
          maxStatePct: maxStateN,
          maxVintagePct: maxVintageN,
          maxAssetPct: maxAssetN,
        },
      });

      // Refresh local view
      setState(readSetupState());
      setExpanded(false);
    } catch (err) {
      setError((err as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated || state.allConfigured) return null;

  return (
    <section
      className="mb-6 rounded-2xl p-6"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            Set up your operator OS
          </div>
          <h2 className="mt-1 font-semibold text-2xl tracking-tight text-[color:var(--color-fg)]">
            {missingCount} setting{missingCount === 1 ? "" : "s"} from a working spine
          </h2>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
            The compliance shield, bid envelope, license gap analysis, and Tape Copilot license
            card all turn on once you've declared your states, capital, and concentration policy.
            30 seconds — you can refine each at the dedicated page later.
          </p>
        </div>
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2 rounded text-[#0a0c14] hover:opacity-90 transition shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            Configure →
          </button>
        )}
      </div>

      {/* Status chips for the 3 pillars */}
      <div className="mt-4 flex items-center gap-2 flex-wrap font-mono text-[10px] tracking-[0.05em] uppercase">
        <StatusChip done={state.hasLicenses}>Compliance licenses</StatusChip>
        <StatusChip done={state.hasCapital}>Capital total</StatusChip>
        <StatusChip done={state.hasConcentration}>Concentration policy</StatusChip>
      </div>

      {expanded && (
        <div className="mt-6 space-y-5 border-t border-[color:var(--color-line)] pt-5">
          {/* Capital */}
          {!state.hasCapital && (
            <div>
              <label className="block">
                <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
                  Total capital to deploy (USD)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={capitalDraft}
                  onChange={(e) => setCapitalDraft(e.target.value)}
                  placeholder="250000"
                  className="w-full max-w-sm bg-[color:var(--color-bg)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
                />
              </label>
              <p className="mt-1 text-[11px] text-[color:var(--color-fg-faint)]">
                Drives the bid envelope on /app/capital and the capital-impact panel in Tape Copilot.
              </p>
            </div>
          )}

          {/* License states */}
          {!state.hasLicenses && (
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  States you can legally collect in
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-1">
                {ALL_US_STATES.map((s) => {
                  const on = selectedStates.has(s.code);
                  const isPrimary = profile.state?.trim().toUpperCase() === s.code;
                  return (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => toggleState(s.code)}
                      title={s.name + (isPrimary ? " (your primary state)" : "")}
                      className={`font-mono text-[10px] tracking-[0.05em] px-2 py-1.5 rounded transition ${
                        on
                          ? "border border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                          : "border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
                      }`}
                    >
                      {s.code}
                      {isPrimary && <span className="ml-0.5 text-[8px]">★</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
                  License type for new seeded records:
                </span>
                {(["Debt buyer", "Collection agency", "Both"] as LicenseType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLicenseType(t)}
                    className={`font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 rounded transition ${
                      licenseType === t
                        ? "border border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                        : "border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[color:var(--color-fg-faint)]">
                {profile.state ? `★ = your primary state (from profile). ` : ""}
                No-license-required states (AL, DE, GA, MS, MO, OH, OK, SC, SD, TX, VA, WY) are
                preselected. Records seeded here are placeholders — confirm at{" "}
                <Link href="/app/compliance" className="underline hover:text-[color:var(--color-accent)]">
                  /app/compliance
                </Link>
                .
              </p>
            </div>
          )}

          {/* Concentration policy */}
          {!state.hasConcentration && (
            <div>
              <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
                Concentration limits (% of total face value)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
                <PolicyInput label="Max % per state" value={maxState} onChange={setMaxState} />
                <PolicyInput label="Max % per vintage" value={maxVintage} onChange={setMaxVintage} />
                <PolicyInput label="Max % per asset class" value={maxAsset} onChange={setMaxAsset} />
              </div>
              <p className="mt-2 text-[11px] text-[color:var(--color-fg-faint)]">
                Defaults reflect typical hedge-fund / SBIC policy memos. Override at{" "}
                <Link href="/app/tools/tape" className="underline hover:text-[color:var(--color-accent)]">
                  /app/tools/tape
                </Link>{" "}
                (Concentration limits) anytime.
              </p>
            </div>
          )}

          {error && (
            <div className="border border-[color:var(--color-danger)] bg-[color:var(--color-bg)] p-3 text-[12.5px] text-[color:var(--color-danger)] rounded">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap justify-end pt-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="font-mono text-xs tracking-[0.2em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-1.5 rounded text-[#0a0c14] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--gradient-primary)" }}
            >
              {saving ? "Saving…" : "Light up the OS"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusChip({
  done,
  children,
}: {
  done: boolean;
  children: React.ReactNode;
}) {
  const color = done ? "var(--color-success)" : "var(--color-warn)";
  return (
    <span
      className="px-2 py-0.5 rounded-full border inline-flex items-center gap-1"
      style={{ color, borderColor: color }}
    >
      <span aria-hidden>{done ? "✓" : "○"}</span>
      {children}
    </span>
  );
}

function PolicyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}
