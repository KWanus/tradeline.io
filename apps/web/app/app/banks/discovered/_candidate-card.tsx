"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIsWatchlisted } from "@/lib/bank-state";
import type { Candidate } from "@/lib/snapshot";
import { relativeAge } from "@/lib/signal-copy";

const DISMISS_KEY = "tradeline.discovered_dismissed.v1";
const DISMISS_EVENT = "tradeline.discovered_dismissed.changed";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function setDismissed(accession: string, dismissed: boolean) {
  if (typeof window === "undefined") return;
  const list = readDismissed();
  const idx = list.indexOf(accession);
  if (dismissed && idx < 0) list.push(accession);
  if (!dismissed && idx >= 0) list.splice(idx, 1);
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT));
  } catch {}
}

function useDismissed(accession: string): [boolean, (next: boolean) => void] {
  const [dismissed, setLocal] = useState(false);
  useEffect(() => {
    setLocal(readDismissed().includes(accession));
    const onChange = () => setLocal(readDismissed().includes(accession));
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISMISS_KEY) setLocal(readDismissed().includes(accession));
    };
    window.addEventListener(DISMISS_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DISMISS_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [accession]);
  const set = (next: boolean) => {
    setDismissed(accession, next);
    setLocal(next);
  };
  return [dismissed, set];
}

export function CandidateCard({ c, promoted }: { c: Candidate; promoted?: boolean }) {
  const [watched, toggleWatched] = useIsWatchlisted(c.ticker || "");
  const [dismissed, setDismissedLocal] = useDismissed(c.accession);

  if (dismissed) {
    return (
      <article className="p-3 rounded-lg border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] text-[12px] text-[color:var(--color-fg-faint)] flex items-center justify-between gap-3">
        <span className="font-mono">
          {c.ticker || `CIK ${c.cik}`} · dismissed
        </span>
        <button
          type="button"
          onClick={() => setDismissedLocal(false)}
          className="font-mono text-[10px] tracking-[0.18em] uppercase hover:text-[color:var(--color-accent)] transition"
        >
          Undo
        </button>
      </article>
    );
  }

  const confTone =
    c.confidence >= 0.7
      ? "text-[color:var(--color-accent)] border-[color:var(--color-accent-dim)]"
      : c.confidence >= 0.5
        ? "text-[color:var(--color-warn)] border-[color:var(--color-warn)]"
        : "text-[color:var(--color-fg-faint)] border-[color:var(--color-line-strong)]";

  return (
    <article
      className={`p-5 rounded-lg border bg-[color:var(--color-bg-1)] transition ${
        promoted
          ? "border-[color:var(--color-accent-dim)]"
          : "border-[color:var(--color-line)]"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          {c.ticker ? (
            <Link
              href={`/app/banks/${c.ticker}`}
              className="font-mono text-xl text-[color:var(--color-accent)] hover:underline"
            >
              {c.ticker}
            </Link>
          ) : (
            <span className="font-mono text-[12px] text-[color:var(--color-fg-faint)]">
              CIK {c.cik}
            </span>
          )}
          {promoted && (
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)]">
              Auto
            </span>
          )}
          {watched && c.ticker && (
            <span className="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)]">
              ★ Watching
            </span>
          )}
        </div>
        <span
          className={`font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded border ${confTone}`}
        >
          conf {c.confidence.toFixed(2)}
        </span>
      </div>

      <div className="mt-1 text-[14px] text-[color:var(--color-fg)] line-clamp-1">
        {c.name}
      </div>
      <div className="mt-2 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        SIC {c.sic} · {c.form_type} · items {c.items.join(", ")} · {relativeAge(c.filed_at)}
      </div>
      <p className="mt-3 text-[12px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-3">
        {c.description}
      </p>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {c.ticker ? (
          <Link
            href={`/app/banks/${c.ticker}`}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#0a0c14] hover:opacity-90 transition"
            style={{ background: "var(--gradient-primary)" }}
          >
            Start outreach ⚡
          </Link>
        ) : null}
        {c.ticker && (
          <button
            type="button"
            onClick={() => toggleWatched()}
            className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border transition ${
              watched
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
            }`}
          >
            {watched ? "★ Watching" : "Watch"}
          </button>
        )}
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-fg)] transition"
        >
          Read filing ↗
        </a>
        <button
          type="button"
          onClick={() => setDismissedLocal(true)}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] hover:border-[color:var(--color-warn)] transition"
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}
