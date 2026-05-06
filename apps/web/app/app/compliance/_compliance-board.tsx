"use client";

import { useEffect, useMemo, useState } from "react";
import { SOL_CHART, US_STATES_2_LETTER, type SolEntry } from "@/lib/sol-chart";

type LicenseType = "Debt buyer" | "Collection agency" | "Both";

type License = {
  id: string;
  state: string;
  licenseType: LicenseType;
  licenseNumber: string;
  issueDate: string;
  expirationDate: string;
  bondAmountUsd: number;
  suretyCarrier: string;
  annualFeeUsd: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "tradeline.compliance.licenses.v1";

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadFromStorage(): License[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as License[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(licenses: License[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(licenses));
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Infinity;
  const ms = d.getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

type Status = "active" | "expiring" | "expired";

function statusOf(l: License): Status {
  const days = daysUntil(l.expirationDate);
  if (days < 0) return "expired";
  if (days <= 90) return "expiring";
  return "active";
}

const STATUS_COPY: Record<Status, { label: string; tone: string }> = {
  active: {
    label: "Active",
    tone: "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]",
  },
  expiring: {
    label: "Expiring soon",
    tone: "text-[color:var(--color-warn)] border-[color:var(--color-warn)]",
  },
  expired: {
    label: "Expired",
    tone: "text-[color:var(--color-danger)] border-[color:var(--color-danger)]",
  },
};

const DEMO: Omit<License, "id" | "createdAt" | "updatedAt">[] = [
  {
    state: "VA",
    licenseType: "Both",
    licenseNumber: "VA-DBC-12345",
    issueDate: "2025-01-15",
    expirationDate: "2027-01-15",
    bondAmountUsd: 25_000,
    suretyCarrier: "Hartford",
    annualFeeUsd: 350,
    notes: "Initial state license. Annual renewal due 12 months ahead.",
  },
  {
    state: "MD",
    licenseType: "Both",
    licenseNumber: "MD-CDC-67890",
    issueDate: "2025-04-22",
    expirationDate: "2026-07-15",
    bondAmountUsd: 5_000,
    suretyCarrier: "Hartford",
    annualFeeUsd: 700,
    notes: "Maryland enforces strictly — verify Reg-F compliance quarterly.",
  },
];

export function ComplianceBoard() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);

  useEffect(() => {
    setLicenses(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(licenses);
  }, [licenses, hydrated]);

  const upsert = (l: License) => {
    setLicenses((prev) => {
      const i = prev.findIndex((x) => x.id === l.id);
      if (i === -1) return [l, ...prev];
      const next = [...prev];
      next[i] = l;
      return next;
    });
    setShowForm(false);
    setEditing(null);
  };

  const remove = (id: string) =>
    setLicenses((prev) => prev.filter((l) => l.id !== id));

  const seedDemo = () => {
    const now = new Date().toISOString();
    setLicenses((prev) => [
      ...DEMO.map((l) => ({ ...l, id: newId(), createdAt: now, updatedAt: now })),
      ...prev,
    ]);
  };

  const stats = useMemo(() => {
    const totalBond = licenses.reduce((s, l) => s + (l.bondAmountUsd || 0), 0);
    const totalAnnual = licenses.reduce((s, l) => s + (l.annualFeeUsd || 0), 0);
    const expiring = licenses.filter((l) => statusOf(l) === "expiring").length;
    const expired = licenses.filter((l) => statusOf(l) === "expired").length;
    const active = licenses.length - expiring - expired;
    return { totalBond, totalAnnual, expiring, expired, active };
  }, [licenses]);

  if (!hydrated) {
    return (
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[color:var(--color-fg-dim)]">
        Loading your compliance data…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <Stat label="Active" value={stats.active} tone="ok" />
        <Stat label="Expiring soon" value={stats.expiring} tone={stats.expiring > 0 ? "warn" : "default"} />
        <Stat label="Expired" value={stats.expired} tone={stats.expired > 0 ? "danger" : "default"} />
        <Stat label="Total bond exposure" value={formatUSD(stats.totalBond)} />
        <Stat label="Annual cost" value={formatUSD(stats.totalAnnual)} />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          + Add license
        </button>
        {licenses.length === 0 && (
          <button
            type="button"
            onClick={seedDemo}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Load demo licenses
          </button>
        )}
        {licenses.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all licenses from this device?")) setLicenses([]);
            }}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Clear all
          </button>
        )}
        <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] ml-auto">
          Saved on this device only
        </span>
      </div>

      {(showForm || editing) && (
        <LicenseForm
          initial={editing}
          onSave={upsert}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Renewal alerts */}
      {(stats.expiring > 0 || stats.expired > 0) && (
        <section className="border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-warn)] uppercase">
            Renewal alerts
          </div>
          <ul className="mt-3 space-y-1.5 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {licenses
              .filter((l) => statusOf(l) !== "active")
              .map((l) => {
                const days = daysUntil(l.expirationDate);
                return (
                  <li key={l.id}>
                    <strong className="text-[color:var(--color-fg)]">{l.state}</strong>{" "}
                    ({l.licenseType}) —{" "}
                    {days < 0 ? (
                      <span className="text-[color:var(--color-danger)]">
                        EXPIRED {Math.abs(days)} days ago
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-warn)]">
                        expires in {days} days ({l.expirationDate})
                      </span>
                    )}
                    {l.suretyCarrier && (
                      <span className="text-[color:var(--color-fg-faint)]">
                        {" · contact "}
                        {l.suretyCarrier}
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {/* Licenses */}
      {licenses.length === 0 ? (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-12 text-center text-[color:var(--color-fg-dim)]">
          <p className="text-[16px] text-[color:var(--color-fg)]">
            No licenses tracked yet.
          </p>
          <p className="mt-2 text-[14px]">
            Click <em>Add license</em> to record a state license, or load 2 demo
            entries to see how it works.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {licenses.map((l) => (
            <LicenseRow
              key={l.id}
              license={l}
              onEdit={() => setEditing(l)}
              onDelete={() => remove(l.id)}
            />
          ))}
        </div>
      )}

      {/* SOL Chart */}
      <SolReference />
    </div>
  );
}

function LicenseRow({
  license,
  onEdit,
  onDelete,
}: {
  license: License;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = statusOf(license);
  const days = daysUntil(license.expirationDate);
  const sol = SOL_CHART.find((s) => s.state === license.state);
  return (
    <article className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-mono text-2xl text-[color:var(--color-accent)]">
              {license.state}
            </span>
            <span className="text-[15px] text-[color:var(--color-fg)]">
              {sol?.name || license.state}
            </span>
            <span className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
              {license.licenseType}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-[color:var(--color-fg-faint)]">
            License # {license.licenseNumber || "—"} · Issued {license.issueDate} · Bond carrier{" "}
            {license.suretyCarrier || "—"}
          </div>
        </div>
        <span
          className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-1 border ${STATUS_COPY[status].tone}`}
        >
          {STATUS_COPY[status].label}
          {status !== "expired" && days !== Infinity && ` · ${days}d left`}
          {status === "expired" && days !== Infinity && ` · ${Math.abs(days)}d ago`}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <SmallStat label="Bond" value={formatUSD(license.bondAmountUsd)} />
        <SmallStat label="Annual fee" value={formatUSD(license.annualFeeUsd)} />
        <SmallStat label="Expires" value={license.expirationDate || "—"} />
        <SmallStat
          label={`SOL · CC / written`}
          value={sol ? `${sol.cc}y / ${sol.written}y` : "—"}
        />
      </div>
      {license.notes && (
        <div className="mt-3 text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
          {license.notes}
        </div>
      )}
      {sol?.notes && (
        <div className="mt-2 text-[12px] text-[color:var(--color-warn)] leading-snug">
          State note: {sol.notes}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-fg)] transition"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this license?")) onDelete();
          }}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
        >
          Del
        </button>
      </div>
    </article>
  );
}

function LicenseForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: License | null;
  onSave: (l: License) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState(initial?.state || "VA");
  const [licenseType, setLicenseType] = useState<LicenseType>(initial?.licenseType || "Both");
  const [licenseNumber, setLicenseNumber] = useState(initial?.licenseNumber || "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate || "");
  const [expirationDate, setExpirationDate] = useState(initial?.expirationDate || "");
  const [bondAmountUsd, setBondAmountUsd] = useState(
    initial?.bondAmountUsd?.toString() || ""
  );
  const [suretyCarrier, setSuretyCarrier] = useState(initial?.suretyCarrier || "");
  const [annualFeeUsd, setAnnualFeeUsd] = useState(
    initial?.annualFeeUsd?.toString() || ""
  );
  const [notes, setNotes] = useState(initial?.notes || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: initial?.id || newId(),
      state: state.toUpperCase(),
      licenseType,
      licenseNumber: licenseNumber.trim(),
      issueDate,
      expirationDate,
      bondAmountUsd: Number(bondAmountUsd) || 0,
      suretyCarrier: suretyCarrier.trim(),
      annualFeeUsd: Number(annualFeeUsd) || 0,
      notes: notes.trim(),
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6"
    >
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-4">
        {initial ? "Edit license" : "New license"}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="State" value={state} onChange={setState} options={US_STATES_2_LETTER} />
        <Select
          label="License type"
          value={licenseType}
          onChange={(v) => setLicenseType(v as LicenseType)}
          options={["Debt buyer", "Collection agency", "Both"]}
        />
        <Input label="License number" value={licenseNumber} onChange={setLicenseNumber} placeholder="e.g. VA-DBC-12345" />
        <Input label="Surety carrier" value={suretyCarrier} onChange={setSuretyCarrier} placeholder="e.g. Hartford" />
        <Input label="Issue date" value={issueDate} onChange={setIssueDate} type="date" />
        <Input label="Expiration date" value={expirationDate} onChange={setExpirationDate} type="date" />
        <Input
          label="Bond amount (USD)"
          value={bondAmountUsd}
          onChange={setBondAmountUsd}
          placeholder="25000"
          type="number"
        />
        <Input
          label="Annual fee (USD)"
          value={annualFeeUsd}
          onChange={setAnnualFeeUsd}
          placeholder="350"
          type="number"
        />
      </div>
      <div className="mt-4">
        <label className="block font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Renewal procedure, surety contact, regulatory updates…"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          {initial ? "Save" : "Add license"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SolReference() {
  const [filter, setFilter] = useState("");
  const filtered = filter
    ? SOL_CHART.filter(
        (s) =>
          s.state.toLowerCase().includes(filter.toLowerCase()) ||
          s.name.toLowerCase().includes(filter.toLowerCase())
      )
    : SOL_CHART;

  return (
    <section>
      <div className="font-mono text-[11px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-3">
        Statute of limitations · 50 states + DC
      </div>
      <p className="text-[14px] text-[color:var(--color-fg-dim)] mb-3 max-w-2xl leading-relaxed">
        Curated reference for SOL on consumer credit-card / open-account debt and
        written contracts. Verify with state-specific counsel before acting on
        any conclusion.
      </p>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by state code or name…"
        className="bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] px-4 py-2 text-[14px] mb-3 w-full md:w-80 focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
      <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] overflow-x-auto">
        <table className="w-full font-mono text-[12px]">
          <thead className="text-[color:var(--color-fg-faint)] tracking-[0.18em] text-[10px] uppercase">
            <tr className="border-b border-[color:var(--color-line)]">
              <th className="px-4 py-2.5 text-left font-normal">State</th>
              <th className="px-4 py-2.5 text-left font-normal">Name</th>
              <th className="px-4 py-2.5 text-right font-normal">CC / open</th>
              <th className="px-4 py-2.5 text-right font-normal">Written</th>
              <th className="px-4 py-2.5 text-left font-normal">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s: SolEntry) => (
              <tr
                key={s.state}
                className="border-b border-[color:var(--color-line)] last:border-b-0 hover:bg-[color:var(--color-bg-2)] transition"
              >
                <td className="px-4 py-2 text-[color:var(--color-accent)]">{s.state}</td>
                <td className="px-4 py-2 text-[color:var(--color-fg)]">{s.name}</td>
                <td className="px-4 py-2 text-right tick">{s.cc}y</td>
                <td className="px-4 py-2 text-right tick">{s.written}y</td>
                <td className="px-4 py-2 text-[color:var(--color-fg-dim)]">{s.notes || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "danger" | "default";
}) {
  const color =
    tone === "danger"
      ? "text-[color:var(--color-danger)]"
      : tone === "warn"
      ? "text-[color:var(--color-warn)]"
      : tone === "ok"
      ? "text-[color:var(--color-accent)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-4">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[color:var(--color-bg-1)] p-3">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-[13px] tick text-[color:var(--color-fg)]">
        {value}
      </div>
    </div>
  );
}
