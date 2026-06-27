"use client";

import { useRef, useState } from "react";

/**
 * Generic CSV import panel. Paste or upload a CSV, see a parsed preview, then
 * commit. Parsing + row typing are delegated to the caller via `parse` and the
 * `T` type param, so the same panel serves pipeline deals, subscribers, etc.
 */

export type CsvPreviewColumn<T> = {
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  /** Singular noun for copy, e.g. "deal". */
  entityLabel: string;
  /** Turn raw CSV text into typed rows. Should never throw — return []. */
  parse: (text: string) => T[];
  previewColumns: CsvPreviewColumn<T>[];
  templateCsv: string;
  templateFilename: string;
  placeholder?: string;
  onCommit: (rows: T[]) => void;
  onClose: () => void;
};

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
  const [rows, setRows] = useState<T[]>([]);
  const [parsed, setParsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runParse = (raw: string) => {
    setText(raw);
    let out: T[] = [];
    try {
      out = parse(raw);
    } catch {
      out = [];
    }
    setRows(out);
    setParsed(true);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => runParse(String(reader.result || ""));
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewRows = rows.slice(0, 8);

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
          Import {entityLabel}s from CSV
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            ↓ Template
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            ↑ Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="hidden"
          />
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => runParse(e.target.value)}
        rows={6}
        placeholder={placeholder || "Paste CSV rows here…"}
        className="w-full bg-[color:var(--color-bg-2)] border border-[color:var(--color-line)] px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />

      {parsed && (
        <div className="mt-4">
          {rows.length === 0 ? (
            <p className="text-[13px] text-[color:var(--color-warn)]">
              No valid {entityLabel} rows found. Check that the first line is a
              header (download the template for the expected columns).
            </p>
          ) : (
            <>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-2">
                Preview · {rows.length} {entityLabel}
                {rows.length === 1 ? "" : "s"}
                {rows.length > previewRows.length
                  ? ` (showing ${previewRows.length})`
                  : ""}
              </div>
              <div className="overflow-x-auto border border-[color:var(--color-line)]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[color:var(--color-bg-2)]">
                      {previewColumns.map((c) => (
                        <th
                          key={c.label}
                          className={`px-3 py-2 font-mono text-[10px] tracking-[0.15em] uppercase text-[color:var(--color-fg-faint)] ${
                            c.align === "right" ? "text-right" : "text-left"
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr
                        key={i}
                        className="border-t border-[color:var(--color-line)]"
                      >
                        {previewColumns.map((c) => (
                          <td
                            key={c.label}
                            className={`px-3 py-2 text-[color:var(--color-fg-dim)] ${
                              c.align === "right" ? "text-right" : "text-left"
                            }`}
                          >
                            {c.render(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => onCommit(rows)}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Import {rows.length > 0 ? rows.length : ""} {entityLabel}
          {rows.length === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-xs tracking-[0.2em] uppercase px-5 py-2.5 border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-fg)] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
