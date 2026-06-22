"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { CsvParseResult } from "@/lib/pipeline-csv";

export type PreviewColumn<T> = {
  label: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

/**
 * Generic CSV import panel. Paste or upload a spreadsheet, see a live preview
 * with per-row validation, download a starter template, then commit. The
 * parsing + typing is entirely the caller's via the `parse` prop, so this
 * component works for pipeline deals, holdings, contacts — anything tabular.
 */
export function CsvImportPanel<T>({
  entityLabel,
  parse,
  previewColumns,
  templateCsv,
  templateFilename,
  placeholder,
  onCommit,
  onClose,
  maxPreviewRows = 8,
}: {
  entityLabel: string;
  parse: (text: string) => CsvParseResult<T>;
  previewColumns: PreviewColumn<T>[];
  templateCsv: string;
  templateFilename: string;
  placeholder?: string;
  onCommit: (rows: T[]) => void;
  onClose?: () => void;
  maxPreviewRows?: number;
}) {
  const [text, setText] = useState("");
  const [committed, setCommitted] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo<CsvParseResult<T>>(() => {
    if (!text.trim()) return { rows: [], errors: [] };
    try {
      return parse(text);
    } catch (err) {
      return { rows: [], errors: [(err as Error).message || "parse failed"] };
    }
  }, [text, parse]);

  const onFile = async (file: File) => {
    const content = await file.text();
    setText(content);
    setCommitted(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const commit = () => {
    if (result.rows.length === 0) return;
    onCommit(result.rows);
    setCommitted(result.rows.length);
    setText("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const rowCount = result.rows.length;
  const preview = result.rows.slice(0, maxPreviewRows);

  return (
    <div className="mb-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Import {entityLabel}s from CSV
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Download template
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close import"
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-faint)] hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)] transition"
            >
              Close
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCommitted(null);
        }}
        placeholder={placeholder || "Paste CSV rows here…"}
        rows={5}
        className="w-full px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[12px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] resize-y"
      />

      {result.errors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {result.errors.slice(0, 6).map((err, i) => (
            <li key={i} className="text-[11.5px] text-[color:var(--color-warn)] leading-snug">
              ⚠ {err}
            </li>
          ))}
          {result.errors.length > 6 && (
            <li className="text-[11px] text-[color:var(--color-fg-faint)] italic">
              +{result.errors.length - 6} more issues
            </li>
          )}
        </ul>
      )}

      {rowCount > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-[color:var(--color-line)]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[color:var(--color-bg-soft)]">
                {previewColumns.map((c) => (
                  <th
                    key={c.label}
                    className={`px-3 py-2 font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] ${
                      c.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-t border-[color:var(--color-line)]">
                  {previewColumns.map((c) => (
                    <td
                      key={c.label}
                      className={`px-3 py-2 text-[color:var(--color-fg-dim)] ${
                        c.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={commit}
          disabled={rowCount === 0}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import {rowCount > 0 ? rowCount : ""} {entityLabel}
          {rowCount === 1 ? "" : "s"}
        </button>
        {rowCount > maxPreviewRows && (
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Showing first {maxPreviewRows} of {rowCount}
          </span>
        )}
        {committed !== null && (
          <span className="text-[12px] text-[color:var(--color-success)]">
            ✓ Imported {committed} {entityLabel}
            {committed === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
