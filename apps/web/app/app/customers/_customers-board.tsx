"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSET_CLASS_OPTIONS,
  CUSTOMER_PLAN_DETAILS,
  CUSTOMER_PLANS_ORDERED,
  DEMO_CUSTOMERS,
  loadFromStorage,
  newId,
  RISK_TONE,
  riskLevel,
  saveToStorage,
  STATUS_TONE,
  type BuyCustomer,
  type CustomerPlan,
  type CustomerStatus,
} from "@/lib/customers";
import { planToTier, TIER_INFO, usePaymentLinks } from "@/lib/billing";

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function relativeDays(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso.slice(0, 10);
  const days = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function CustomersBoard() {
  const [customers, setCustomers] = useState<BuyCustomer[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<BuyCustomer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "trial" | "at-risk">("all");

  useEffect(() => {
    setCustomers(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveToStorage(customers);
  }, [customers, hydrated]);

  const upsert = (c: BuyCustomer) => {
    setCustomers((prev) => {
      const i = prev.findIndex((x) => x.id === c.id);
      if (i === -1) return [c, ...prev];
      const next = [...prev];
      next[i] = c;
      return next;
    });
    setEditing(null);
    setShowForm(false);
  };

  const remove = (id: string) =>
    setCustomers((prev) => prev.filter((c) => c.id !== id));

  const seedDemo = () => {
    const now = new Date().toISOString();
    setCustomers((prev) => [
      ...DEMO_CUSTOMERS.map((c) => ({
        ...c,
        id: newId(),
        createdAt: now,
        updatedAt: now,
      })),
      ...prev,
    ]);
  };

  const stats = useMemo(() => {
    const active = customers.filter((c) => c.status === "active");
    const trial = customers.filter((c) => c.status === "trial");
    const churned = customers.filter((c) => c.status === "churned");
    const totalMrr = customers.reduce((s, c) => s + c.mrrUsd, 0);
    const atRisk = customers.filter((c) => riskLevel(c) === "at-risk");
    const designPartners = customers.filter((c) => c.designPartner);
    const planMix: Record<CustomerPlan, number> = {
      trial: 0,
      solo: 0,
      pro: 0,
      team: 0,
      enterprise: 0,
    };
    for (const c of customers) planMix[c.plan]++;
    return {
      active: active.length,
      trial: trial.length,
      churned: churned.length,
      atRisk: atRisk.length,
      designPartners: designPartners.length,
      totalMrr,
      planMix,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    if (filter === "all") return customers;
    if (filter === "at-risk") return customers.filter((c) => riskLevel(c) === "at-risk");
    return customers.filter((c) => c.status === filter);
  }, [customers, filter]);

  if (!hydrated) {
    return (
      <div className="card p-6 text-center text-[color:var(--color-fg-dim)]">
        Loading customers…
      </div>
    );
  }

  const atRiskList = customers.filter((c) => riskLevel(c) === "at-risk");

  return (
    <div className="space-y-10">
      {atRiskList.length > 0 && <AtRiskStrip customers={atRiskList} />}

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Active"
          value={stats.active}
          sub={`${stats.designPartners} design partner${stats.designPartners === 1 ? "" : "s"}`}
          tone="ok"
        />
        <Stat
          label="MRR"
          value={formatUSD(stats.totalMrr)}
          sub={`${formatUSD(stats.totalMrr * 12)} ARR`}
          tone="strong"
        />
        <Stat
          label="In trial"
          value={stats.trial}
          sub="Convert before day 14"
          tone={stats.trial > 0 ? "warn" : "default"}
        />
        <Stat
          label="At risk"
          value={stats.atRisk}
          sub="Inactive 14d+ on paid plan"
          tone={stats.atRisk > 0 ? "danger" : "default"}
        />
      </section>

      {/* Plan mix */}
      <section className="card p-5">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-3">
          Plan mix · path to $5k MRR
        </div>
        <div className="grid grid-cols-5 gap-2">
          {CUSTOMER_PLANS_ORDERED.map((p) => {
            const info = CUSTOMER_PLAN_DETAILS[p];
            const count = stats.planMix[p];
            return (
              <div key={p} className="text-center">
                <div className="font-mono text-2xl text-[color:var(--color-fg)] tick">
                  {count}
                </div>
                <div className="text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)] mt-0.5">
                  {info.label}
                </div>
                <div className="text-[10px] text-[color:var(--color-fg-faint)] mt-0.5">
                  ${info.mrrUsd}/mo
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions + filters */}
      <section className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Add customer
        </button>
        {customers.length === 0 && (
          <button type="button" onClick={seedDemo} className="btn-secondary">
            Load 5 demo customers
          </button>
        )}
        <div className="ml-auto flex items-center gap-1 flex-wrap text-[11px] font-mono tracking-[0.15em] uppercase">
          {(["all", "active", "trial", "at-risk"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md border transition ${
                filter === f
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {showForm && (
        <CustomerForm
          initial={editing}
          onSave={upsert}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-12 text-center text-[color:var(--color-fg-dim)]">
          {customers.length === 0 ? (
            <>
              <p className="font-serif text-[20px] text-[color:var(--color-fg)] italic">
                No customers yet.
              </p>
              <p className="mt-2 text-[14px]">
                Click <em>Add customer</em> when your first paying customer signs up,
                or load 5 demo entries to see the dashboard in action.
              </p>
            </>
          ) : (
            <p className="text-[14px]">No customers match the &quot;{filter}&quot; filter.</p>
          )}
        </div>
      ) : (
        <section className="space-y-4">
          {filtered.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              onEdit={() => {
                setEditing(c);
                setShowForm(true);
              }}
              onDelete={() => remove(c.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function CustomerRow({
  customer,
  onEdit,
  onDelete,
}: {
  customer: BuyCustomer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const planInfo = CUSTOMER_PLAN_DETAILS[customer.plan];
  const risk = riskLevel(customer);
  const [links] = usePaymentLinks();
  const tier = planToTier(customer.plan);
  const payLink = tier ? links[tier] : undefined;
  const payMail = payLink
    ? `mailto:${encodeURIComponent(customer.contactEmail)}?subject=${encodeURIComponent(
        `Tradeline ${TIER_INFO[tier!].label} subscription`
      )}&body=${encodeURIComponent(
        `Hi ${customer.contactName.split(" ")[0] || "there"},\n\nHere's the secure Stripe checkout link to start your Tradeline ${TIER_INFO[tier!].label} subscription:\n\n${payLink}\n\nIt's a 14-day free trial; nothing charges until day 15. Cancel any time from the link Stripe emails you after sign-up.\n\nLet me know if anything looks off.\n`
      )}`
    : "";

  return (
    <article className="card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-serif italic text-[22px] text-[color:var(--color-fg)] tracking-tight">
              {customer.orgName}
            </h3>
            {customer.designPartner && (
              <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)]">
                Design partner
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--color-fg-faint)]">
            {customer.contactName} ·{" "}
            <span className="text-[color:var(--color-fg-dim)]">{customer.contactEmail}</span>
            {customer.affiliateReferrer && (
              <> · ref by {customer.affiliateReferrer}</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] tracking-[0.16em] uppercase px-2 py-1 rounded border ${STATUS_TONE[customer.status]}`}
          >
            {customer.status}
          </span>
          <span className="text-[10px] tracking-[0.16em] uppercase px-2 py-1 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)]">
            {planInfo.label} · {formatUSD(customer.mrrUsd)}/mo
          </span>
          {risk === "at-risk" && (
            <span className="text-[10px] tracking-[0.16em] uppercase px-2 py-1 rounded border border-[color:var(--color-danger)] text-[color:var(--color-danger)]">
              At risk
            </span>
          )}
          {risk === "watch" && (
            <span className="text-[10px] tracking-[0.16em] uppercase px-2 py-1 rounded border border-[color:var(--color-warn)] text-[color:var(--color-warn)]">
              Watch
            </span>
          )}
          {payLink && (
            <a
              href={payMail}
              title={`Email ${customer.contactEmail} the ${TIER_INFO[tier!].label} pay link`}
              className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 rounded-md text-[#1a0c00] hover:opacity-90 transition"
              style={{ background: "var(--gradient-primary)" }}
            >
              Send pay link →
            </a>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md hover:border-[color:var(--color-fg)] transition"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this customer?")) onDelete();
            }}
            className="text-[11px] tracking-[0.16em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] rounded-md text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
          >
            Del
          </button>
        </div>
      </div>

      {/* Details grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="Licensed states">
          {customer.licensedStates.length === 0
            ? "—"
            : customer.licensedStates.join(" · ")}
        </Field>
        <Field label="Asset class focus">
          {customer.assetClassFocus.length === 0
            ? "—"
            : customer.assetClassFocus.join(" · ")}
        </Field>
        <Field label="Last activity">
          <span className={RISK_TONE[risk]}>
            {relativeDays(customer.lastActivityAt)}
          </span>
        </Field>
        <Field label="Usage (last 7 days)">
          <span className="font-mono">
            {customer.radarVisitsLastWeek} radar · {customer.mcpToolCallsLastWeek} MCP
          </span>
        </Field>
      </div>

      {customer.notes && (
        <p className="mt-4 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed border-l-2 border-[color:var(--color-line)] pl-3">
          {customer.notes}
        </p>
      )}
    </article>
  );
}

function CustomerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: BuyCustomer | null;
  onSave: (c: BuyCustomer) => void;
  onCancel: () => void;
}) {
  const [orgName, setOrgName] = useState(initial?.orgName || "");
  const [contactName, setContactName] = useState(initial?.contactName || "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail || "");
  const [plan, setPlan] = useState<CustomerPlan>(initial?.plan || "trial");
  const [status, setStatus] = useState<CustomerStatus>(initial?.status || "trial");
  const [mrrUsd, setMrrUsd] = useState(
    initial?.mrrUsd?.toString() || "0"
  );
  const [startDate, setStartDate] = useState(
    initial?.startDate || new Date().toISOString().slice(0, 10)
  );
  const [licensedStatesText, setLicensedStatesText] = useState(
    initial?.licensedStates.join(", ") || ""
  );
  const [assetClasses, setAssetClasses] = useState<string[]>(
    initial?.assetClassFocus || []
  );
  const [designPartner, setDesignPartner] = useState(
    initial?.designPartner || false
  );
  const [affiliateReferrer, setAffiliateReferrer] = useState(
    initial?.affiliateReferrer || ""
  );
  const [lastActivityAt, setLastActivityAt] = useState(
    initial?.lastActivityAt || new Date().toISOString().slice(0, 10)
  );
  const [radarVisitsLastWeek, setRadarVisitsLastWeek] = useState(
    initial?.radarVisitsLastWeek?.toString() || "0"
  );
  const [mcpToolCallsLastWeek, setMcpToolCallsLastWeek] = useState(
    initial?.mcpToolCallsLastWeek?.toString() || "0"
  );
  const [notes, setNotes] = useState(initial?.notes || "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      id: initial?.id || newId(),
      orgName: orgName.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      plan,
      status,
      mrrUsd: Number(mrrUsd) || 0,
      startDate,
      licensedStates: licensedStatesText
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      assetClassFocus: assetClasses,
      designPartner,
      affiliateReferrer: affiliateReferrer.trim(),
      lastActivityAt,
      radarVisitsLastWeek: Number(radarVisitsLastWeek) || 0,
      mcpToolCallsLastWeek: Number(mcpToolCallsLastWeek) || 0,
      notes: notes.trim(),
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    });
  };

  const toggleAsset = (a: string) => {
    setAssetClasses((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  return (
    <form onSubmit={submit} className="card-elevated p-6">
      <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-5">
        {initial ? "Edit customer" : "New customer"}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Org name" value={orgName} onChange={setOrgName} required />
        <Input
          label="Contact email"
          value={contactEmail}
          onChange={setContactEmail}
          type="email"
          required
        />
        <Input
          label="Contact name"
          value={contactName}
          onChange={setContactName}
        />
        <Select
          label="Plan"
          value={plan}
          onChange={(v) => {
            setPlan(v as CustomerPlan);
            setMrrUsd(CUSTOMER_PLAN_DETAILS[v as CustomerPlan].mrrUsd.toString());
          }}
          options={CUSTOMER_PLANS_ORDERED.map((p) => ({
            value: p,
            label: `${CUSTOMER_PLAN_DETAILS[p].label} · $${CUSTOMER_PLAN_DETAILS[p].mrrUsd}/mo`,
          }))}
        />
        <Select
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as CustomerStatus)}
          options={[
            { value: "trial", label: "Trial" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "churned", label: "Churned" },
          ]}
        />
        <Input
          label="MRR (USD)"
          value={mrrUsd}
          onChange={setMrrUsd}
          type="number"
        />
        <Input
          label="Start date"
          value={startDate}
          onChange={setStartDate}
          type="date"
        />
        <Input
          label="Last activity"
          value={lastActivityAt}
          onChange={setLastActivityAt}
          type="date"
        />
        <Input
          label="Radar visits (last 7 days)"
          value={radarVisitsLastWeek}
          onChange={setRadarVisitsLastWeek}
          type="number"
        />
        <Input
          label="MCP tool calls (last 7 days)"
          value={mcpToolCallsLastWeek}
          onChange={setMcpToolCallsLastWeek}
          type="number"
        />
        <Input
          label="Affiliate referrer (optional)"
          value={affiliateReferrer}
          onChange={setAffiliateReferrer}
        />
        <label className="flex items-center gap-3 mt-7 cursor-pointer">
          <input
            type="checkbox"
            checked={designPartner}
            onChange={(e) => setDesignPartner(e.target.checked)}
            className="w-4 h-4 accent-[color:var(--color-accent)]"
          />
          <span className="text-[13px] text-[color:var(--color-fg)]">
            Design partner (50% off for life)
          </span>
        </label>
      </div>

      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
          Licensed states (comma-separated, 2-letter codes)
        </label>
        <input
          type="text"
          value={licensedStatesText}
          onChange={(e) => setLicensedStatesText(e.target.value)}
          placeholder="e.g. VA, MD, NC, GA"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>

      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          Asset class focus
        </label>
        <div className="flex flex-wrap gap-2">
          {ASSET_CLASS_OPTIONS.map((a) => {
            const on = assetClasses.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAsset(a)}
                className={`text-[12px] px-3 py-1.5 rounded-md border transition ${
                  on
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Onboarding context, expansion conversations, churn risk signals…"
          className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className="btn-primary">
          {initial ? "Save" : "Add customer"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "ok" | "warn" | "strong" | "danger" | "default";
}) {
  const color =
    tone === "strong"
      ? "text-[color:var(--color-accent)]"
      : tone === "ok"
      ? "text-[color:var(--color-fg)]"
      : tone === "warn"
      ? "text-[color:var(--color-warn)]"
      : tone === "danger"
      ? "text-[color:var(--color-danger)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="card p-5">
      <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
      {sub && (
        <div className="mt-1 text-[11px] text-[color:var(--color-fg-faint)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--color-fg)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
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
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AtRiskStrip({ customers }: { customers: BuyCustomer[] }) {
  return (
    <div
      className="relative rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase">
            <span
              className="px-2 py-0.5 rounded-full text-[#1a0c00] font-semibold"
              style={{ background: "var(--gradient-primary)" }}
            >
              Call this week
            </span>
            <span className="text-[color:var(--color-fg-faint)]">
              · {customers.length} at risk
            </span>
          </div>
          <h2 className="mt-1.5 font-serif italic text-xl text-[color:var(--color-fg)]">
            These customers haven&rsquo;t shown up in 14+ days.
          </h2>
          <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            Send a personal check-in email or schedule a 15-minute call before they churn.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {customers.slice(0, 6).map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[14px] text-[color:var(--color-fg)] truncate">
                {c.orgName}
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-danger)]">
                {formatUSD(c.mrrUsd)}/mo
              </span>
            </div>
            <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] truncate">
              {c.contactName} · {c.contactEmail}
            </div>
            <a
              href={`mailto:${c.contactEmail}?subject=Quick check-in`}
              className="mt-2 inline-block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
            >
              Send check-in →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
