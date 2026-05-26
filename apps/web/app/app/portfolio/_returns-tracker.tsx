"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  buildReturnsReport,
  deleteReturn,
  generateReturnNoticeText,
  newReturnId,
  readReturns,
  returnsCsv,
  upsertReturn,
  type EnrichedReturn,
  type HoldingForReturns,
  type ReturnReason,
  type ReturnRecord,
  type ReturnStatus,
  type ReturnsReport,
} from "@/lib/returns-tracker";
import { logAction } from "@/lib/activity-log";

const PORTFOLIO_KEY = "tradeline.portfolio.holdings.v1";
const RETURNS_KEY = "tradeline.returns.v1";

type RawHolding = {
  id?: string;
  ticker?: string;
  seller?: string;
  servicer?: string;
  assetClass?: string;
  faceValueUsd?: number;
  purchasePriceUsd?: number;
  purchaseDate?: string;
};

function readHoldings(): HoldingForReturns[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((h: RawHolding, i: number) => ({
      id: String(h.id ?? `h${i}`),
      ticker: String(h.ticker ?? ""),
      seller: String(h.seller ?? ""),
      servicer: String(h.servicer ?? ""),
      assetClass: String(h.assetClass ?? ""),
      faceValueUsd: Number(h.faceValueUsd) || 0,
      purchasePriceUsd: Number(h.purchasePriceUsd) || 0,
      purchaseDate: String(h.purchaseDate ?? ""),
    }));
  } catch {
    return [];
  }
}

function fmtUsd(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function ReturnsTracker() {
  const [hydrated, setHydrated] = useState(false);
  const [holdings, setHoldings] = useState<HoldingForReturns[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [addingFor, setAddingFor] = useState<string | null>(null); // holdingId
  // Opt-in GitHub-backup state
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function backupToGitHub() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/server-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store: "returns", data: returns }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string; sha?: string };
      if (data.ok) {
        setSyncMessage(`✓ Backed up to GitHub data branch (${returns.length} return${returns.length === 1 ? "" : "s"})`);
      } else {
        setSyncMessage(`✗ Backup failed: ${data.reason ?? "unknown"}`);
      }
    } catch (err) {
      setSyncMessage(`✗ Backup error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function restoreFromGitHub() {
    if (
      returns.length > 0 &&
      !confirm("Restore will REPLACE your local returns with the remote backup. Continue?")
    )
      return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/server-store?store=returns");
      if (res.status === 404) {
        setSyncMessage("No remote backup found yet — click Backup to create one.");
        setSyncing(false);
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        data?: ReturnRecord[];
        reason?: string;
      };
      if (data.ok && Array.isArray(data.data)) {
        // Write to local + update state
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tradeline.returns.v1", JSON.stringify(data.data));
        }
        setReturns(data.data);
        setSyncMessage(`✓ Restored ${data.data.length} return${data.data.length === 1 ? "" : "s"} from GitHub backup`);
      } else {
        setSyncMessage(`✗ Restore failed: ${data.reason ?? "unknown"}`);
      }
    } catch (err) {
      setSyncMessage(`✗ Restore error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  function refresh() {
    setHoldings(readHoldings());
    setReturns(readReturns());
  }

  useEffect(() => {
    refresh();
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === PORTFOLIO_KEY || e.key === RETURNS_KEY) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const holdingsById = useMemo(() => {
    const m = new Map<string, HoldingForReturns>();
    for (const h of holdings) m.set(h.id, h);
    return m;
  }, [holdings]);

  const report: ReturnsReport = useMemo(
    () => buildReturnsReport(returns, holdingsById),
    [returns, holdingsById]
  );

  function downloadCsv() {
    const csv = returnsCsv(report.allReturns, holdingsById);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `returns_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!hydrated) return null;
  if (holdings.length === 0) return null; // need at least one holding

  // Group returns by holding for the per-holding accordions
  const returnsByHolding = new Map<string, EnrichedReturn[]>();
  for (const r of report.allReturns) {
    const list = returnsByHolding.get(r.holdingId) ?? [];
    list.push(r);
    returnsByHolding.set(r.holdingId, list);
  }

  const urgentTone =
    report.urgentReturns.some((r) => r.urgencyTier === "expired")
      ? "var(--color-danger)"
      : report.urgentReturns.length > 0
      ? "var(--color-warn)"
      : "var(--color-fg-faint)";

  return (
    <section className="mb-8 space-y-4">
      {/* HEADLINE */}
      <div
        className="rounded-2xl p-6"
        style={{
          background:
            "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
          border: "1.5px solid transparent",
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
                Returns &amp; refunds
              </span>
              {report.urgentReturns.length > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.05em] uppercase"
                  style={{ background: urgentTone, color: "var(--color-bg)" }}
                >
                  {report.urgentReturns.length} urgent
                </span>
              )}
            </div>
            <h2 className="mt-1 font-semibold text-2xl tracking-tight text-[color:var(--color-fg)]">
              {report.allReturns.length === 0
                ? "No returns flagged yet."
                : `${report.countByStatus.flagged + report.countByStatus.contacted} open · ${fmtUsd(report.totalRefundExpectedUsd)} expected · ${fmtUsd(report.totalRefundReceivedUsd)} recovered`}
            </h2>
            <p className="mt-2 text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              {report.headline}
            </p>
          </div>
          {report.allReturns.length > 0 && (
            <button
              type="button"
              onClick={downloadCsv}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              ↓ Returns CSV
            </button>
          )}
        </div>

        {report.allReturns.length > 0 && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatusStat label="Flagged" value={report.countByStatus.flagged} tone="warn" />
            <StatusStat
              label="Contacted"
              value={report.countByStatus.contacted}
              tone="accent"
            />
            <StatusStat label="Returned" value={report.countByStatus.returned} tone="ok" />
            <StatusStat label="Rejected" value={report.countByStatus.rejected} tone="danger" />
            <StatusStat label="Expired" value={report.countByStatus.expired} tone="danger" />
          </div>
        )}

        {/* OPT-IN BACKUP — multi-device sync via private GitHub data branch */}
        <div className="mt-4 pt-4 border-t border-[color:var(--color-line)] flex items-center gap-2 flex-wrap text-[11px]">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Backup (opt-in)
          </span>
          <button
            type="button"
            disabled={syncing || returns.length === 0}
            onClick={backupToGitHub}
            className="font-mono text-[10px] tracking-[0.15em] uppercase px-3 py-1 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {syncing ? "…" : "Backup to GitHub"}
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={restoreFromGitHub}
            className="font-mono text-[10px] tracking-[0.15em] uppercase px-3 py-1 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {syncing ? "…" : "Restore from GitHub"}
          </button>
          {syncMessage && (
            <span
              className={`font-mono text-[10px] ${
                syncMessage.startsWith("✓")
                  ? "text-[color:var(--color-success)]"
                  : syncMessage.startsWith("✗")
                  ? "text-[color:var(--color-danger)]"
                  : "text-[color:var(--color-fg-dim)]"
              }`}
            >
              {syncMessage}
            </span>
          )}
          <span className="ml-auto text-[10px] text-[color:var(--color-fg-faint)] italic">
            Manual sync only · data branch on private repo
          </span>
        </div>
      </div>

      {/* URGENT QUEUE */}
      {report.urgentReturns.length > 0 && (
        <div className="border bg-[color:var(--color-bg-1)] p-5 rounded-xl" style={{ borderColor: urgentTone }}>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: urgentTone }}>
            Urgent — send notices this week
          </div>
          <ul className="mt-3 space-y-1.5">
            {report.urgentReturns.map((r) => {
              const h = holdingsById.get(r.holdingId);
              return (
                <li
                  key={r.id}
                  className="flex items-baseline gap-3 font-mono text-[12px] py-1.5"
                >
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-[0.08em] uppercase shrink-0"
                    style={{
                      background:
                        r.urgencyTier === "expired"
                          ? "var(--color-danger)"
                          : "var(--color-warn)",
                      color: "var(--color-bg)",
                    }}
                  >
                    {r.urgencyTier === "expired"
                      ? `${Math.abs(r.daysRemaining ?? 0)}d past`
                      : `${r.daysRemaining ?? 0}d left`}
                  </span>
                  <span className="text-[color:var(--color-accent)] shrink-0">
                    {h?.ticker || h?.seller || "—"}
                  </span>
                  <span className="text-[color:var(--color-fg-dim)] flex-1 truncate min-w-0">
                    row {r.rowIndex} · {RETURN_REASON_LABELS[r.reason]}
                  </span>
                  <span className="text-[color:var(--color-fg)] tabular-nums shrink-0">
                    {fmtUsd(r.refundExpectedUsd ?? r.refundExpectedAuto)} refund
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* PER-HOLDING ACCORDION — only show holdings that have returns or where operator clicks Add */}
      <div className="space-y-3">
        {holdings.map((h) => {
          const list = returnsByHolding.get(h.id) ?? [];
          const isAdding = addingFor === h.id;
          if (list.length === 0 && !isAdding) {
            return (
              <div
                key={h.id}
                className="flex items-center gap-3 px-4 py-2 border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] rounded text-[12px] flex-wrap"
              >
                <span className="font-mono text-[color:var(--color-fg-dim)] flex-1 min-w-[200px]">
                  {h.ticker || h.seller || "Holding"} ({h.assetClass || "—"}) ·{" "}
                  {fmtUsd(h.faceValueUsd)} face · purchased {h.purchaseDate || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => setAddingFor(h.id)}
                  className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
                >
                  + Flag a return
                </button>
              </div>
            );
          }
          return (
            <HoldingReturnsCard
              key={h.id}
              holding={h}
              returns={list}
              onAdd={() => setAddingFor(h.id)}
              isAdding={isAdding}
              onAddSubmit={(r) => {
                upsertReturn(r);
                setReturns(readReturns());
                setAddingFor(null);
                logAction({
                  type: "return_flagged",
                  pillar: "returns",
                  summary: `Flagged ${RETURN_REASON_LABELS[r.reason]} on ${h.ticker || h.seller || "holding"} row ${r.rowIndex} (face ${fmtUsd(r.faceValueUsd)})`,
                  deepLink: "/app/portfolio",
                  meta: {
                    holdingId: h.id,
                    reason: r.reason,
                    faceValueUsd: r.faceValueUsd,
                  },
                });
              }}
              onAddCancel={() => setAddingFor(null)}
              onUpdate={(r) => {
                const prior = returns.find((x) => x.id === r.id);
                upsertReturn(r);
                setReturns(readReturns());
                if (prior && prior.status !== r.status) {
                  logAction({
                    type: "return_status_changed",
                    pillar: "returns",
                    summary: `${RETURN_REASON_LABELS[r.reason]} return on ${h.ticker || h.seller || "holding"} row ${r.rowIndex}: ${RETURN_STATUS_LABELS[prior.status]} → ${RETURN_STATUS_LABELS[r.status]}${r.refundReceivedUsd ? ` (refund ${fmtUsd(r.refundReceivedUsd)})` : ""}`,
                    deepLink: "/app/portfolio",
                    meta: {
                      holdingId: h.id,
                      fromStatus: prior.status,
                      toStatus: r.status,
                      refundReceivedUsd: r.refundReceivedUsd ?? 0,
                    },
                  });
                }
              }}
              onDelete={(id) => {
                if (!confirm("Delete this return record?")) return;
                deleteReturn(id);
                setReturns(readReturns());
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function StatusStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "danger" | "accent" | "default";
}) {
  const color =
    tone === "ok"
      ? "var(--color-success)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "danger"
      ? "var(--color-danger)"
      : tone === "accent"
      ? "var(--color-accent)"
      : "var(--color-fg)";
  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg)] px-3 py-3">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[20px]" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function HoldingReturnsCard({
  holding,
  returns,
  onAdd,
  isAdding,
  onAddSubmit,
  onAddCancel,
  onUpdate,
  onDelete,
}: {
  holding: HoldingForReturns;
  returns: EnrichedReturn[];
  onAdd: () => void;
  isAdding: boolean;
  onAddSubmit: (r: ReturnRecord) => void;
  onAddCancel: () => void;
  onUpdate: (r: ReturnRecord) => void;
  onDelete: (id: string) => void;
}) {
  function downloadNotice() {
    const open = returns.filter((r) => r.status === "flagged" || r.status === "contacted");
    if (open.length === 0) return;
    const text = generateReturnNoticeText({
      operatorName: "[Your operator name]",
      holding,
      returns: open,
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `return_notice_${holding.ticker || holding.id}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const openCount = returns.filter((r) => r.status === "flagged" || r.status === "contacted").length;

  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-mono text-[16px] text-[color:var(--color-accent)] shrink-0">
          {holding.ticker || holding.seller || "Holding"}
        </span>
        <span className="text-[13px] text-[color:var(--color-fg-dim)] flex-1 truncate">
          {holding.seller || "—"} · {fmtUsd(holding.faceValueUsd)} face · purchased{" "}
          {holding.purchaseDate || "—"}
        </span>
        <span className="font-mono text-[10px] text-[color:var(--color-fg-faint)] shrink-0">
          {returns.length} return{returns.length === 1 ? "" : "s"} ({openCount} open)
        </span>
        {openCount > 0 && (
          <button
            type="button"
            onClick={downloadNotice}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:opacity-90 transition shrink-0"
          >
            ↓ Notice template
          </button>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition shrink-0"
        >
          + Flag a return
        </button>
      </div>

      {isAdding && (
        <ReturnForm
          holdingId={holding.id}
          onSubmit={onAddSubmit}
          onCancel={onAddCancel}
        />
      )}

      {returns.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {returns
            .sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999))
            .map((r) => (
              <ReturnRow key={r.id} r={r} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
        </div>
      )}
    </div>
  );
}

function ReturnRow({
  r,
  onUpdate,
  onDelete,
}: {
  r: EnrichedReturn;
  onUpdate: (r: ReturnRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [refundReceived, setRefundReceived] = useState(
    r.refundReceivedUsd !== undefined ? String(r.refundReceivedUsd) : ""
  );
  const urgencyColor =
    r.urgencyTier === "expired"
      ? "var(--color-danger)"
      : r.urgencyTier === "critical"
      ? "var(--color-warn)"
      : r.urgencyTier === "warning"
      ? "var(--color-fg-dim)"
      : "var(--color-fg-faint)";

  function changeStatus(newStatus: ReturnStatus) {
    const now = new Date().toISOString();
    const update: ReturnRecord = {
      ...r,
      status: newStatus,
      contactedDate:
        newStatus === "contacted" && !r.contactedDate ? now.slice(0, 10) : r.contactedDate,
      resolvedDate:
        (newStatus === "returned" || newStatus === "rejected" || newStatus === "expired") &&
        !r.resolvedDate
          ? now.slice(0, 10)
          : r.resolvedDate,
      refundReceivedUsd: newStatus === "returned" ? Number(refundReceived) || r.refundExpectedAuto : r.refundReceivedUsd,
      updatedAt: now,
    };
    onUpdate(update);
  }

  return (
    <div className="rounded border border-[color:var(--color-line)] bg-[color:var(--color-bg)] p-3">
      <div className="flex items-baseline gap-3 flex-wrap text-[12px]">
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase shrink-0" style={{ color: urgencyColor }}>
          {r.daysRemaining !== null
            ? r.daysRemaining < 0
              ? `${Math.abs(r.daysRemaining)}d past`
              : `${r.daysRemaining}d left`
            : "no window"}
        </span>
        <span className="font-mono text-[color:var(--color-fg-dim)] shrink-0">
          row {r.rowIndex}
        </span>
        <span className="text-[color:var(--color-fg)] flex-1 truncate min-w-0">
          {RETURN_REASON_LABELS[r.reason]}
        </span>
        <span className="font-mono text-[color:var(--color-fg-dim)] tabular-nums shrink-0">
          face {fmtUsd(r.faceValueUsd)}
        </span>
        <span className="font-mono text-[color:var(--color-accent)] tabular-nums shrink-0">
          refund {fmtUsd(r.refundExpectedUsd ?? r.refundExpectedAuto)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
        <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
          {RETURN_STATUS_LABELS[r.status]}
        </span>
        {r.status === "flagged" && (
          <button
            type="button"
            onClick={() => changeStatus("contacted")}
            className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:opacity-90 rounded transition"
          >
            Mark contacted
          </button>
        )}
        {(r.status === "flagged" || r.status === "contacted") && (
          <>
            <input
              type="number"
              value={refundReceived}
              onChange={(e) => setRefundReceived(e.target.value)}
              placeholder="refund $"
              className="w-24 px-2 py-1 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[11px] rounded focus:outline-none focus:border-[color:var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => changeStatus("returned")}
              className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-success)] text-[color:var(--color-success)] hover:opacity-90 rounded transition"
            >
              Mark returned
            </button>
            <button
              type="button"
              onClick={() => changeStatus("rejected")}
              className="font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 border border-[color:var(--color-danger)] text-[color:var(--color-danger)] hover:opacity-90 rounded transition"
            >
              Rejected
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onDelete(r.id)}
          className="ml-auto font-mono text-[10px] tracking-[0.05em] text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-danger)] transition"
        >
          delete
        </button>
      </div>
      {r.notes && (
        <p className="mt-1 text-[11px] text-[color:var(--color-fg-faint)] italic">{r.notes}</p>
      )}
    </div>
  );
}

function ReturnForm({
  holdingId,
  onSubmit,
  onCancel,
}: {
  holdingId: string;
  onSubmit: (r: ReturnRecord) => void;
  onCancel: () => void;
}) {
  const [rowIndex, setRowIndex] = useState("");
  const [reason, setReason] = useState<ReturnReason>("dispute");
  const [faceValue, setFaceValue] = useState("");
  const [flaggedDate, setFlaggedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const idx = Number(rowIndex);
    const face = Number(faceValue.replace(/[,$\s]/g, ""));
    if (!Number.isFinite(idx) || idx <= 0) return;
    if (!Number.isFinite(face) || face <= 0) return;
    const now = new Date().toISOString();
    onSubmit({
      id: newReturnId(),
      holdingId,
      rowIndex: idx,
      reason,
      status: "flagged",
      flaggedDate,
      faceValueUsd: face,
      notes: notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg)] p-4 rounded space-y-3"
    >
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
        Flag an account for return
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <FormInput label="Row index" value={rowIndex} onChange={setRowIndex} placeholder="e.g. 1487" type="number" />
        <FormSelect
          label="Reason"
          value={reason}
          onChange={(v) => setReason(v as ReturnReason)}
          options={Object.entries(RETURN_REASON_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        />
        <FormInput label="Face value (USD)" value={faceValue} onChange={setFaceValue} placeholder="2500" type="number" />
        <FormInput label="Flagged date" value={flaggedDate} onChange={setFlaggedDate} type="date" />
      </div>
      <FormInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="e.g. servicer flagged on 2026-05-02 ticket" />
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs tracking-[0.2em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="font-mono text-xs tracking-[0.2em] uppercase px-3 py-1.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
        >
          Flag
        </button>
      </div>
    </form>
  );
}

function FormInput({
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
      <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[color:var(--color-accent)] transition"
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
