"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light" | "tradeline";
export const STORAGE_KEY = "tradeline.theme.v1";

export function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light" || v === "tradeline";
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads the saved theme from localStorage on mount and keeps the
 * <html data-theme="..."> attribute in sync. The actual initial theme is
 * set by the inline boot script in app/layout.tsx (prevents FOUC) — this
 * component just maintains the runtime contract.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (isTheme(raw)) {
        setThemeState(raw);
        document.documentElement.setAttribute("data-theme", raw);
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {}
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Permissive fallback so anything rendered outside the provider doesn't
    // crash — the data-attribute still drives the actual visuals.
    return { theme: "dark", setTheme: () => {} };
  }
  return ctx;
}
