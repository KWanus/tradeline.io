"use client";

import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "dark", label: "Dark", icon: "◐" },
  { value: "light", label: "Light", icon: "○" },
  { value: "tradeline", label: "Tradeline", icon: "▲" },
];

/**
 * Three-way segmented control for theme switching. Active option uses the
 * gradient pill treatment (re-tints automatically via --gradient-primary).
 * Icons-only on md screens; icon + label on xl+ to save top-bar real estate.
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)]"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Switch to ${opt.label} theme`}
            onClick={() => setTheme(opt.value)}
            className={
              active
                ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono tracking-[0.14em] uppercase font-semibold text-[#0a0c14] transition"
                : "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono tracking-[0.14em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
            }
            style={
              active
                ? {
                    background: "var(--gradient-primary)",
                    boxShadow:
                      "0 4px 14px -4px rgba(var(--tint-accent-rgb), 0.55)",
                  }
                : undefined
            }
          >
            <span aria-hidden>{opt.icon}</span>
            <span className="hidden lg:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
