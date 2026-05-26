"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acknowledgeRule,
  CATEGORY_LABELS,
  readAcks,
  RULE_CHANGES,
  RULE_CHANGES_VERSION,
  unacknowledgeRule,
  type RuleCategory,
  type RuleSeverity,
} from "@/lib/state-rule-changelog";

const SEVERITY_COLOR: Record<RuleSeverity, string> = {
  critical: "var(--color-danger)",
  high: "var(--color-warn)",
  moderate: "var(--color-fg-dim)",
};

const ALL_STATES = ["All states"];
const FILTER_CATEGORIES: Array<{ id: RuleCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "sol", label: "SOL" },
  { id: "licensing", label: "Licensing" },
  { id: "validation", label: "Validation" },
  { id: "medical_debt", label: "Medical" },
  { id: "credit_reporting", label: "CRA" },
  { id: "fees", label: "Fees" },
  { id: "enforcement", label: "Enforcement" },
];

export function RuleChangelogPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<RuleCategory | "all">("all");
  const [showAcked, setShowAcked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const r of RULE_CHANGES) set.add(r.state);
    return ["", ...Array.from(set).sort()];
  }, []);

  const ackIds = useMemo(() => {
    if (!hydrated) return new Set<string>();
    return new Set(readAcks().acknowledgedIds);
    // refreshKey here forces useMemo to re-read after acknowledge / un-ack
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  const filtered = useMemo(() => {
    return RULE_CHANGES.filter((r) => {
      if (stateFilter && r.state !== stateFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      const acked = ackIds.has(r.id);
      if (!showAcked && acked) return false;
      return true;
    }).sort((a, b) => {
      const sevOrder: Record<RuleSeverity, number> = {
        critical: 0,
        high: 1,
        moderate: 2,
      };
      const s = sevOrder[a.severity] - sevOrder[b.severity];
      if (s !== 0) return s;
      return new Date(b.dateEffective).getTime() - new Date(a.dateEffective).getTime();
    });
  }, [stateFilter, categoryFilter, showAcked, ackIds]);

  function toggleAck(id: string) {
    if (ackIds.has(id)) {
      unacknowledgeRule(id);
    } else {
      acknowledgeRule(id);
    }
    setRefreshKey((k) => k + 1);
  }

  if (!hydrated) return null;

  return (
    <section id="rule-changelog" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            State-rule changelog
          </div>
          <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-snug max-w-2xl">
            Curated feed of state regulatory changes since 2020 that materially affect consumer
            debt buyers/collectors. Each entry cites a public source — confirm with counsel
            before acting on any signal. Dataset version {RULE_CHANGES_VERSION}.
          </p>
        </div>
        <div className="font-mono text-[10px] text-[color:var(--color-fg-faint)]">
          {filtered.length} of {RULE_CHANGES.length} rules
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap font-mono text-[11px]">
        <label className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            State
          </span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-[color:var(--color-bg)] border border-[color:var(--color-line)] px-2 py-1 text-[12px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          >
            {states.map((s) => (
              <option key={s || "ALL"} value={s}>
                {s || ALL_STATES[0]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mr-1">
            Category
          </span>
          {FILTER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`px-2 py-0.5 rounded text-[10px] tracking-[0.05em] transition border ${
                categoryFilter === c.id
                  ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowAcked((v) => !v)}
          className={`ml-auto px-2 py-0.5 rounded text-[10px] tracking-[0.05em] transition border ${
            showAcked
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)]"
          }`}
        >
          {showAcked ? "Hiding acknowledged" : "Show acknowledged"}
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 text-center text-[13px] text-[color:var(--color-fg-dim)]">
          No rules match the current filters.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => {
            const acked = ackIds.has(r.id);
            return (
              <li
                key={r.id}
                className="border bg-[color:var(--color-bg-1)] p-4 rounded"
                style={{ borderColor: acked ? "var(--color-line)" : SEVERITY_COLOR[r.severity] }}
              >
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-[0.08em] font-semibold uppercase shrink-0"
                    style={{
                      background: SEVERITY_COLOR[r.severity],
                      color: "var(--color-bg)",
                    }}
                  >
                    {r.state} · {r.severity}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--color-fg-dim)] tracking-[0.05em]">
                    {CATEGORY_LABELS[r.category]}
                  </span>
                  <span className="text-[14px] text-[color:var(--color-fg)] font-medium flex-1 min-w-0">
                    {r.title}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)] shrink-0">
                    effective {r.dateEffective}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAck(r.id)}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition shrink-0"
                  >
                    {acked ? "Unack" : "Ack"}
                  </button>
                </div>
                <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
                  {r.summary}
                </p>
                <p className="mt-2 text-[12.5px] text-[color:var(--color-fg)] leading-snug">
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] mr-2">
                    Impact
                  </span>
                  {r.impact}
                </p>
                <div className="mt-2 flex items-center gap-3 flex-wrap font-mono text-[10px] text-[color:var(--color-fg-faint)]">
                  <a
                    href={r.source}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--color-accent)] hover:underline"
                  >
                    Source →
                  </a>
                  {r.affectedAssetClasses && r.affectedAssetClasses.length > 0 && (
                    <span>
                      affects: {r.affectedAssetClasses.join(", ")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
