"use client";

import { useState } from "react";
import {
  buildOperatorStateExport,
  downloadOperatorStateExport,
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
        <button
          type="button"
          onClick={exportNow}
          disabled={busy}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 rounded-full text-[#0a0c14] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          style={{ background: "var(--gradient-primary)" }}
        >
          {busy ? "Bundling…" : "Export now"}
        </button>
      </div>
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
