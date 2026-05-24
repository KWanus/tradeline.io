"use client";

import { useEffect, useState } from "react";

type Shortcut = {
  keys: string[];
  label: string;
  hint?: string;
};

const SHORTCUTS: { section: string; items: Shortcut[] }[] = [
  {
    section: "Anywhere",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette", hint: "search banks, jump to any page" },
      { keys: ["?"], label: "Show this overlay" },
      { keys: ["Esc"], label: "Close any open modal" },
    ],
  },
  {
    section: "Daily loop",
    items: [
      { keys: ["G", "T"], label: "Go to /today", hint: "the queue" },
      { keys: ["G", "B"], label: "Go to /banks", hint: "the radar" },
      { keys: ["G", "P"], label: "Go to /pipeline", hint: "deals in flight" },
      { keys: ["G", "A"], label: "Go to /autopilot", hint: "control center" },
    ],
  },
];

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    t.isContentEditable
  );
}

/**
 * Press `?` anywhere to toggle. Esc to close. Lists every global keyboard
 * shortcut in a glass modal so power users can self-discover the chord
 * vocabulary. Mounted once at the app root.
 *
 * NOTE: the chords (g t / g b / etc) are listed as future commitments —
 * they are not yet wired. When we add router-aware chord handling, the
 * list here is the contract. For now ⌘K and ? are the only live keys.
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up"
      onClick={() => setOpen(false)}
    >
      <div
        className="card-elevated max-w-lg w-full p-6 md:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-5 gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
              Keyboard
            </div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[color:var(--color-fg)]">
              Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
            aria-label="Close shortcuts"
          >
            Esc ✕
          </button>
        </div>

        <div className="space-y-5">
          {SHORTCUTS.map((section) => (
            <div key={section.section}>
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2.5">
                {section.section}
              </div>
              <ul className="space-y-2">
                {section.items.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center gap-3 text-[13px]"
                  >
                    <span className="flex items-center gap-1 shrink-0 min-w-[64px]">
                      {s.keys.map((k, i) => (
                        <span key={i} className="kbd">
                          {k}
                        </span>
                      ))}
                    </span>
                    <span className="text-[color:var(--color-fg)]">
                      {s.label}
                    </span>
                    {s.hint && (
                      <span className="text-[color:var(--color-fg-faint)] text-[12px] truncate">
                        — {s.hint}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-[color:var(--color-line)] text-[11px] text-[color:var(--color-fg-faint)] font-mono tracking-[0.06em]">
          Press <span className="kbd">?</span> to toggle this anytime.
        </div>
      </div>
    </div>
  );
}
