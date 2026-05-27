"use client";

import { useRef, useState } from "react";
import {
  applyRestore,
  buildOperatorStateExport,
  downloadOperatorStateDigest,
  downloadOperatorStateExport,
  previewRestore,
  type RestorePreview,
} from "@/lib/operator-state-export";

// One-click whole-OS export card. Lives on /app/profile because it's
// operator-personal admin (backup, portability, sharing). Pulls every
// spine + workflow store from localStorage into a single JSON file.
// Nothing transmits server-side; the file downloads to the operator's
// machine via blob URL.

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function OperatorStateExportCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    text: string;
    preview: RestorePreview;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function preview(): { storeCount: number; totalBytes: number } | null {
    if (typeof window === "undefined") return null;
    try {
      const p = buildOperatorStateExport();
      return { storeCount: p.storeCount, totalBytes: p.totalBytes };
    } catch {
      return null;
    }
  }

  function exportNow() {
    setBusy(true);
    setMessage(null);
    const result = downloadOperatorStateExport();
    if (result.ok) {
      setMessage(`✓ Downloaded ${fmtBytes(result.bytes)} JSON snapshot`);
    } else {
      setMessage("✗ Export failed — check browser console");
    }
    setBusy(false);
  }

  function exportDigest() {
    setBusy(true);
    setMessage(null);
    const result = downloadOperatorStateDigest();
    if (result.ok) {
      setMessage(`✓ Downloaded ${fmtBytes(result.bytes)} markdown digest (PII-free)`);
    } else {
      setMessage("✗ Digest failed — check browser console");
    }
    setBusy(false);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const preview = previewRestore(text);
      if (!preview.ok) {
        setMessage(`✗ Import preview failed: ${preview.reason ?? "unknown"}`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setPendingRestore({ text, preview });
    };
    reader.onerror = () => {
      setMessage("✗ Could not read file");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  function confirmRestore() {
    if (!pendingRestore) return;
    setBusy(true);
    setMessage(null);
    const r = applyRestore(pendingRestore.text);
    if (r.ok) {
      setMessage(
        `✓ Restored ${r.restoredCount} store${r.restoredCount === 1 ? "" : "s"}${r.skippedCount > 0 ? ` (${r.skippedCount} skipped)` : ""}. Reloading…`
      );
      setPendingRestore(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Hard refresh so every page-mounted store rehydrates from the
      // restored localStorage. Without this, components that read on
      // mount keep stale state until the operator navigates.
      if (typeof window !== "undefined") {
        setTimeout(() => window.location.reload(), 400);
      }
    } else {
      setMessage(`✗ Restore failed: ${r.reason ?? "unknown"}`);
    }
    setBusy(false);
  }

  function cancelRestore() {
    setPendingRestore(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage(null);
  }

  const p = typeof window !== "undefined" ? preview() : null;

  return (
    <section className="mt-12 rounded-2xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Whole-OS export
          </div>
          <h2 className="mt-1 text-xl font-semibold text-[color:var(--color-fg)]">
            Download your operator state as JSON
          </h2>
          <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
            Bundles every spine + workflow store (compliance licenses, capital
            config, concentration policy, license map, holdings, pipeline deals,
            collections, returns, fingerprint hashes, activity log, profile,
            briefing cache, tutor messages, all acknowledgments) into one
            JSON file. Use for: backups, sharing with counsel, migrating to a
            new browser, or a cold-storage snapshot before a risky change.
            Nothing transmits server-side — the file downloads to your machine.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <label
            className={`font-mono text-xs tracking-[0.2em] uppercase px-4 py-2.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition cursor-pointer ${
              busy ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            {busy ? "…" : "Import"}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              disabled={busy}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={exportDigest}
            disabled={busy}
            title="Sanitized markdown — counts and totals only, no PII. Safe to paste into a chat LLM or forward to your accountant."
            className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "…" : "Markdown digest"}
          </button>
          <button
            type="button"
            onClick={exportNow}
            disabled={busy}
            className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 rounded-full text-[#0a0c14] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--gradient-primary)" }}
          >
            {busy ? "Bundling…" : "Export now"}
          </button>
        </div>
      </div>

      {pendingRestore && (
        <div className="mt-5 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-bg)] p-4">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            Confirm restore — will OVERWRITE current state
          </div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px]">
            <div>
              <div className="text-[color:var(--color-fg-faint)]">From snapshot</div>
              <div className="text-[color:var(--color-fg)] mt-1">
                {pendingRestore.preview.payloadExportedAt
                  ? new Date(pendingRestore.preview.payloadExportedAt).toLocaleString()
                  : "(no timestamp)"}
              </div>
            </div>
            <div>
              <div className="text-[color:var(--color-fg-faint)]">Stores to restore</div>
              <div className="text-[color:var(--color-fg)] mt-1">
                {pendingRestore.preview.totalStoresInPayload}
              </div>
            </div>
            <div>
              <div className="text-[color:var(--color-fg-faint)]">Payload size</div>
              <div className="text-[color:var(--color-fg)] mt-1">
                {fmtBytes(pendingRestore.preview.totalBytesInPayload)}
              </div>
            </div>
          </div>
          <div className="mt-3 max-h-48 overflow-y-auto">
            <ul className="space-y-0.5 font-mono text-[10.5px]">
              {pendingRestore.preview.toRestore.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-2"
                >
                  <span
                    className="text-center w-3 shrink-0"
                    style={{
                      color: s.willOverwriteExisting
                        ? "var(--color-warn)"
                        : "var(--color-success)",
                    }}
                  >
                    {s.willOverwriteExisting ? "↻" : "+"}
                  </span>
                  <span className="text-[color:var(--color-fg-dim)] flex-1 truncate">{s.key}</span>
                  <span className="text-[color:var(--color-fg-faint)] tabular-nums shrink-0">
                    {s.willOverwriteExisting
                      ? `overwrites ${fmtBytes(s.existingBytes)}`
                      : "new"}
                  </span>
                  <span className="text-[color:var(--color-fg)] tabular-nums shrink-0 w-16 text-right">
                    {fmtBytes(s.incomingBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={cancelRestore}
              disabled={busy}
              className="font-mono text-xs tracking-[0.2em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRestore}
              disabled={busy}
              className="font-mono text-xs tracking-[0.2em] uppercase px-3 py-1.5 bg-[color:var(--color-warn)] text-[color:var(--color-bg)] hover:opacity-90 transition disabled:opacity-40"
            >
              {busy ? "Restoring…" : "Restore"}
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-center gap-4 flex-wrap font-mono text-[11px] text-[color:var(--color-fg-dim)]">
        {p && (
          <>
            <span>
              <span className="text-[color:var(--color-fg)]">{p.storeCount}</span>{" "}
              stores populated
            </span>
            <span>
              <span className="text-[color:var(--color-fg)]">
                {fmtBytes(p.totalBytes)}
              </span>{" "}
              raw payload
            </span>
          </>
        )}
        {message && (
          <span
            className={
              message.startsWith("✓")
                ? "text-[color:var(--color-success)]"
                : "text-[color:var(--color-danger)]"
            }
          >
            {message}
          </span>
        )}
        <span className="ml-auto italic text-[color:var(--color-fg-faint)]">
          Includes fingerprint hashes (no PII). Activity log + briefing cache may
          include short summaries.
        </span>
      </div>
    </section>
  );
}
