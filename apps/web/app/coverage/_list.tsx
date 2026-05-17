"use client";

import { useMemo, useState } from "react";

export type CoverageRow = {
  ticker: string;
  name: string;
  tier: string;
  status: "strong" | "watching" | "quiet" | "unknown" | string;
  confidence: number;
  filings: number;
  signals: number;
  news: number;
  lastFiledAt: string;
  autoDiscovered: boolean;
};

type StatusFilter = "all" | "strong" | "watching" | "quiet";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All",
  strong: "Strong",
  watching: "Watching",
  quiet: "Quiet",
};

function relativeDate(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 2) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)}+ yr ago`;
}

export function CoverageList({ rows }: { rows: CoverageRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const hay =
          r.ticker.toLowerCase() +
          " " +
          r.name.toLowerCase() +
          " " +
          r.tier.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      strong: rows.filter((r) => r.status === "strong").length,
      watching: rows.filter((r) => r.status === "watching").length,
      quiet: rows.filter((r) => r.status === "quiet").length,
    };
  }, [rows]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-wrap mb-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by ticker, name, or tier…"
          className="flex-1 min-w-[220px] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded-md px-3 py-2.5 text-[14px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "strong", "watching", "quiet"] as StatusFilter[]).map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`font-mono text-[11px] tracking-[0.15em] uppercase px-3 py-2 rounded-md border transition ${
                  active
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)]"
                }`}
              >
                {STATUS_LABEL[s]}{" "}
                <span className="ml-1 text-[color:var(--color-fg-faint)]">
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[14px] text-[color:var(--color-fg-dim)]">
          No matches. Try clearing the search or switching filter.
        </div>
      ) : (
        <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_120px_90px] md:grid-cols-[100px_1.4fr_1fr_110px_90px_110px] gap-3 px-5 py-3 border-b border-[color:var(--color-line)] font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            <div>Ticker</div>
            <div>Name</div>
            <div className="hidden md:block">Tier</div>
            <div className="text-right md:text-left">Conf</div>
            <div className="hidden md:block text-right">Filings</div>
            <div className="text-right">Last</div>
          </div>
          <ul className="divide-y divide-[color:var(--color-line)]">
            {filtered.map((r) => (
              <li
                key={r.ticker}
                className="grid grid-cols-[80px_1fr_120px_90px] md:grid-cols-[100px_1.4fr_1fr_110px_90px_110px] gap-3 px-5 py-3 items-center hover:bg-[color:var(--color-bg-2)] transition"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] text-[color:var(--color-accent)]">
                    {r.ticker}
                  </span>
                  {r.autoDiscovered && (
                    <span
                      className="font-mono text-[8px] tracking-[0.18em] uppercase px-1 py-0.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)]"
                      title="Auto-discovered by the SEC scanner"
                    >
                      Auto
                    </span>
                  )}
                </div>
                <div className="text-[14px] text-[color:var(--color-fg)] truncate">
                  {r.name}
                </div>
                <div className="hidden md:block text-[12px] text-[color:var(--color-fg-dim)] truncate">
                  {r.tier}
                </div>
                <div className="text-right md:text-left">
                  <ConfBadge value={r.confidence} status={r.status} />
                </div>
                <div className="hidden md:block text-right font-mono text-[12px] text-[color:var(--color-fg-dim)]">
                  {r.filings}
                </div>
                <div className="text-right font-mono text-[11px] text-[color:var(--color-fg-faint)]">
                  {relativeDate(r.lastFiledAt)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[12px] font-mono text-[color:var(--color-fg-faint)] leading-relaxed">
        Showing {filtered.length} of {rows.length} tracked banks.
        {statusFilter !== "all" || query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="ml-2 text-[color:var(--color-accent)] hover:underline"
          >
            Reset filters
          </button>
        ) : null}
      </p>
    </div>
  );
}

function ConfBadge({
  value,
  status,
}: {
  value: number;
  status: string;
}) {
  const tone =
    status === "strong"
      ? "border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
      : status === "watching"
        ? "border-[color:var(--color-warn)] text-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]"
        : "border-[color:var(--color-line-strong)] text-[color:var(--color-fg-faint)]";
  return (
    <span
      className={`inline-block font-mono text-[11px] tracking-[0.05em] px-2 py-0.5 rounded border ${tone}`}
    >
      {value.toFixed(2)}
    </span>
  );
}
