"use client";

import { useMemo, useState, type ReactNode } from "react";

export type PreviewColumn<T> = {
  label: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

type Props<T> = {
  entityLabel: string;
  parse: (text: string) => T[];
  previewColumns: PreviewColumn<T>[];
  templateCsv: string;
  templateFilename: string;
  placeholder?: string;
  onCommit: (rows: T[]) => void;
  onClose?: () => void;
};

/** Generic paste-or-upload CSV importer with a live preview and a commit step.
 * Used by the pipeline board (and reusable for any tabular import). */
export function CsvImportPanel<T>({
  entityLabel,
  parse,
  previewColumns,
  templateCsv,
  templateFilename,
  placeholder,
  onCommit,
  onClose,
}: Props<T>) {
  const [text, setText] = useState("");
  const [committed, setCommitted] = useState(0);

  const rows = useMemo<T[]>(() => {
    if (!text.trim()) return [];
    try {
      return parse(text);
    } catch {
      return [];
    }
  }, [text, parse]);

  const templateHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`,
    [templateCsv]
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Import {entityLabel}s · CSV
        </div>
        <div className="flex items-center gap-3">
          <a
            href={templateHref}
            download={templateFilename}
            className="font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-accent)] hover:underline"
          >
            Download template ↓
          </a>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close import"
              className="font-mono text-[12px] text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || "Paste CSV rows here…"}
        rows={5}
        className="w-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left font-mono text-[10px] tracking-[0.14em] uppercase text-[color:var(--color-fg-faint)]">
                {previewColumns.map((c) => (
                  <th
                    key={c.label}
                    className={`py-1.5 pr-4 ${c.align === "right" ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r, i) => (
                <tr key={i} className="border-t border-[color:var(--color-line)]">
                  {previewColumns.map((c) => (
                    <td
                      key={c.label}
                      className={`py-1.5 pr-4 ${c.align === "right" ? "text-right" : ""}`}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 && (
            <div className="mt-2 text-[11px] text-[color:var(--color-fg-faint)]">
              +{rows.length - 8} more row{rows.length - 8 === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => {
            onCommit(rows);
            setCommitted(rows.length);
            setText("");
          }}
          className="font-mono text-[11px] tracking-[0.16em] uppercase px-4 py-2 rounded-md border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Import {rows.length || ""} {entityLabel}
          {rows.length === 1 ? "" : "s"}
        </button>
        {committed > 0 && (
          <span className="text-[12px] text-[color:var(--color-success)]">
            Imported {committed}.
          </span>
        )}
      </div>
    </div>
  );
}
